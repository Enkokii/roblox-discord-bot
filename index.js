require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const axios = require("axios");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const GAMEPASS_ID = process.env.GAMEPASS_ID;

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith("!inv")) {
    const args = message.content.split(" ");
    if (args.length < 2) {
      return message.reply("Please provide a Roblox user ID. Example: `!inv 123456`");
    }

    const robloxId = args[1];

    try {
      const res = await axios.get(`https://inventory.roblox.com/v1/users/${robloxId}/items/GamePass/${GAMEPASS_ID}`);

      const embed = new EmbedBuilder()
        .setColor(res.data && res.data.data.length > 0 ? 0x57F287 : 0xED4245)
        .setTitle("🎮 Gamepass Ownership Check")
        .setDescription(
          res.data && res.data.data.length > 0
            ? `✅ \`@${robloxId}\` owns the gamepass.`
            : `❌ \`@${robloxId}\` does **not** own the gamepass.`
        )
        .setFooter({ text: "Roblox Gamepass Checker", iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      message.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      message.reply("⚠️ There was an error checking the inventory. Make sure the Roblox user ID is valid and the gamepass exists.");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
