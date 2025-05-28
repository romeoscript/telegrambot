const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const dotenv = require("dotenv");
const fs = require("fs");

dotenv.config();

if (!process.env.API_ID || !process.env.API_HASH) {
  console.error(
    "Please set the API_ID and API_HASH environment variables.",
  );
  process.exit(1);
}

const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const sessionFile = "session.txt";
const sessionString = fs.existsSync(sessionFile)
  ? fs.readFileSync(sessionFile).toString()
  : "";

const stringSession = new StringSession(sessionString);

async function sendMessagesToUsers(userIdentifiers, message) {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    await client.start({
      phoneNumber: async () => await input.text("number ?"),
      password: async () => await input.text("password?"),
      phoneCode: async () => await input.text("Code ?"),
      onError: (err) => console.log(err),
    });

    console.log("Connected to Telegram. Starting to send messages...");

    // Save session for future use
    fs.writeFileSync(sessionFile, client.session.save());
    console.log(`Session saved to ${sessionFile}`);

    // Send messages to each user
    const results = [];
    for (const userIdentifier of userIdentifiers) {
      try {
        // Try to resolve the entity first
        let entity;
        try {
          entity = await client.getEntity(userIdentifier);
          console.log(`✅ Entity resolved for ${userIdentifier}`);
        } catch (entityError) {
          console.error(`❌ Could not resolve entity for ${userIdentifier}:`, entityError.message);
          results.push({ 
            userIdentifier, 
            status: 'failed', 
            error: `Entity resolution failed: ${entityError.message}` 
          });
          continue;
        }

        // Send the message
        await client.sendMessage(entity, { message });
        console.log(`✅ Message sent to user ${userIdentifier}`);
        results.push({ userIdentifier, status: 'success' });
      } catch (error) {
        console.error(`❌ Failed to send message to user ${userIdentifier}:`, error.message);
        results.push({ userIdentifier, status: 'failed', error: error.message });
      }
      // Add a small delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Save results to a file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = `message_results_${timestamp}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to ${resultsFile}`);

    return results;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  } finally {
    await client.disconnect();
  }
}

// Helper function to get user info
async function getUserInfo(userIdentifier) {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    await client.start({
      phoneNumber: async () => await input.text("number ?"),
      password: async () => await input.text("password?"),
      phoneCode: async () => await input.text("Code ?"),
      onError: (err) => console.log(err),
    });

    const entity = await client.getEntity(userIdentifier);
    console.log('User info:', {
      id: entity.id,
      username: entity.username,
      firstName: entity.firstName,
      lastName: entity.lastName,
      phone: entity.phone
    });
    
    return entity;
  } catch (error) {
    console.error("Error getting user info:", error.message);
    throw error;
  } finally {
    await client.disconnect();
  }
}

// Example usage
async function main() {
  try {
    // Using usernames from your table
    const userIdentifiers = [
      "@wheval",
      "@Oxjkodesage", 
      "@Veri5ied",
      "@romeoscript",
      "@jeffDZ40"
    ];

    // Option 2: If you must use IDs, try to get user info first
    // Uncomment this to test entity resolution:
    // try {
    //   await getUserInfo(1156109562);
    // } catch (error) {
    //   console.log("User ID 1156109562 cannot be resolved");
    // }

    if (userIdentifiers.length === 0) {
      console.log("No valid user identifiers found");
      return;
    }

    const message = "Hello! This is a test message from the Telegram API script.";

    console.log(`Preparing to send message to ${userIdentifiers.length} users...`);
    console.log("User identifiers:", userIdentifiers);
    const results = await sendMessagesToUsers(userIdentifiers, message);
    
    // Print summary
    const successCount = results.filter(r => r.status === 'success').length;
    const failCount = results.filter(r => r.status === 'failed').length;
    console.log(`\nSummary:`);
    console.log(`✅ Successfully sent: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
  } catch (error) {
    console.error("Main error:", error);
  }
}

// Run the script
main();