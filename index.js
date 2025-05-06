require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
} = require("discord.js");
const noblox = require("noblox.js");
const axios = require("axios");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const PHASE1_GAMEPASS_ID = process.env.PHASE1_GAMEPASS_ID;
const PHASE2_GAMEPASS_ID = process.env.PHASE2_GAMEPASS_ID;
const PHASE3_GAMEPASS_ID = process.env.PHASE3_GAMEPASS_ID;
const GROUP_ID = parseInt(process.env.ROBLOX_GROUP_ID);
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE;

const GAMEPASSES = {
  Phase1: PHASE1_GAMEPASS_ID,
  Phase2: PHASE2_GAMEPASS_ID,
  Phase3: PHASE3_GAMEPASS_ID,
};

const ROLE_DATA = {
  Phase1: { rank: 6, name: "ROYAL TESTERS!" },
  Phase2: { rank: 6, name: "ROYAL TESTERS!" },
  Phase3: { rank: 6, name: "VOID PHASE HUNTER" },
};

const RANK_COMMAND_ROLE_ID = "1335249684490489937";

function hasPermission(message, command) {
  if (command === "rank") {
    return message.member.permissions.has(
      PermissionsBitField.Flags.Administrator,
    );
  }
  if (command === "inv") {
    return (
      message.member.roles.cache.has(RANK_COMMAND_ROLE_ID) ||
      message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    );
  }
  return false;
}

client.once("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  if (!ROBLOX_COOKIE) {
    console.error("❌ ROBLOX cookie is not set.");
    process.exit(1);
  }

  try {
    await noblox.setCookie(ROBLOX_COOKIE);
    const currentUser = await noblox.getAuthenticatedUser();
    console.log(`✅ Roblox login successful as ${currentUser.name}`);
  } catch (err) {
    console.error("❌ Failed to authenticate with Roblox cookie:", err.message);
    process.exit(1);
  }
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!")) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args[0].toLowerCase();

  if (command === "rank") {
    if (!hasPermission(message, "rank")) return;
    if (args.length < 2)
      return message.reply("Usage: `!rank <username> [Phase1|Phase2|Phase3]`");

    let robloxId, robloxUsername;

    try {
      const userRes = await axios.post(
        "https://users.roblox.com/v1/usernames/users",
        {
          usernames: [args[1]],
          excludeBannedUsers: true,
        },
      );

      if (!userRes.data || userRes.data.data.length === 0) {
        return message.reply("⚠️ Roblox username not found.");
      }

      robloxId = userRes.data.data[0].id;
      robloxUsername = userRes.data.data[0].name;
    } catch (err) {
      return message.reply("⚠️ Error retrieving user ID.");
    }

    let specifiedPhase = null;
    if (args[2]) {
      const phaseInput = args[2].toLowerCase();
      if (["phase1", "phase2", "phase3"].includes(phaseInput)) {
        specifiedPhase =
          phaseInput.charAt(0).toUpperCase() + phaseInput.slice(1);
      } else {
        return message.reply(
          "⚠️ Invalid phase. Use: Phase1, Phase2, or Phase3.",
        );
      }
    }

    let rankToAssign = null;
    let roleNameToAssign = null;

    if (specifiedPhase) {
      rankToAssign = ROLE_DATA[specifiedPhase].rank;
      roleNameToAssign = ROLE_DATA[specifiedPhase].name;
    } else {
      const phasesOwned = [];
      for (const [phase, gamepassId] of Object.entries(GAMEPASSES)) {
        try {
          const res = await axios.get(
            `https://inventory.roblox.com/v1/users/${robloxId}/items/GamePass/${gamepassId}`,
          );
          if (res.data && res.data.data.length > 0) {
            phasesOwned.push(phase);
          }
        } catch {}
      }

      if (phasesOwned.length === 0) {
        return message.reply(
          `❌ \`${robloxUsername}\` doesn't own any of the 3 gamepasses. Use \`!rank ${robloxUsername} Phase1|2|3\` to rank manually.`,
        );
      }

      if (phasesOwned.includes("Phase3")) specifiedPhase = "Phase3";
      else if (phasesOwned.includes("Phase2")) specifiedPhase = "Phase2";
      else if (phasesOwned.includes("Phase1")) specifiedPhase = "Phase1";

      rankToAssign = ROLE_DATA[specifiedPhase].rank;
      roleNameToAssign = ROLE_DATA[specifiedPhase].name;
    }

    try {
      const currentRank = await noblox.getRankInGroup(GROUP_ID, robloxId);

      if (currentRank === rankToAssign) {
        const currentRoleName = (await noblox.getRole(GROUP_ID, currentRank))
          .name;
        if (currentRoleName === roleNameToAssign) {
          return message.reply(
            `✅ \`${robloxUsername}\` is already ranked as ${roleNameToAssign}.`,
          );
        }
      }

      await noblox.setRank(GROUP_ID, robloxId, rankToAssign, roleNameToAssign);
      message.reply(`✅ Ranked \`${robloxUsername}\` as ${roleNameToAssign}.`);
    } catch (err) {
      console.error(err);
      message.reply(
        "⚠️ Failed to rank the user. Make sure they are in the group.",
      );
    }
  }

  if (command === "inv") {
    if (!hasPermission(message, "inv")) return;
    if (args.length < 2) return message.reply("Usage: `!inv <username>`");

    try {
      const userRes = await axios.post(
        "https://users.roblox.com/v1/usernames/users",
        {
          usernames: [args[1]],
          excludeBannedUsers: true,
        },
      );

      if (!userRes.data || userRes.data.data.length === 0) {
        return message.reply("⚠️ Roblox username not found.");
      }

      const robloxId = userRes.data.data[0].id;
      const robloxUsername = userRes.data.data[0].name;

      const ownedPhases = [];

      for (const [phase, gamepassId] of Object.entries(GAMEPASSES)) {
        try {
          const res = await axios.get(
            `https://inventory.roblox.com/v1/users/${robloxId}/items/GamePass/${gamepassId}`,
          );
          if (res.data && res.data.data.length > 0) {
            ownedPhases.push(`${phase.replace("Phase", "Phase ")} Tester`);
          }
        } catch {}
      }

      const embed = new EmbedBuilder()
        .setTitle("Gamepass Ownership Check")
        .setFooter({
          text: "SBLR Gamepass Checker",
          iconURL: client.user.displayAvatarURL(),
        })
        .setTimestamp();

      if (ownedPhases.length === 0) {
        embed
          .setColor("Red")
          .setDescription(
            `❌ \`${robloxUsername}\` does not own any tester gamepasses.`,
          );
      } else {
        embed
          .setColor("Green")
          .setDescription(
            `✅ \`${robloxUsername}\` owns the following gamepasses:\n\n• ${ownedPhases.join("\n• ")}`,
          );
      }

      message.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      message.reply("⚠️ Failed to check gamepass ownership.");
    }
  }
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});
client.login(DISCORD_TOKEN);
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

app.listen(3000, () => {
  console.log("🌐 Express server is running on port 3000");
});
