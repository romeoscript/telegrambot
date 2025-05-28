const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const dotenv = require("dotenv");
const fs = require("fs");
const { parse } = require("json2csv"); // npm i json2csv

dotenv.config();

if (!process.env.API_ID || !process.env.API_HASH || !process.env.GROUP_ID) {
  console.error(
    "Please set the API_ID, API_HASH and GROUP_ID environment variables.",
  );
  process.exit(1);
}

const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const groupId = parseInt(process.env.GROUP_ID);
const PARTICIPANT_LIMIT = 500;
const CSV_OUTPUT = "participants.csv";

const sessionFile = "session.txt";
const sessionString = fs.existsSync(sessionFile)
  ? fs.readFileSync(sessionFile).toString()
  : "";

const updateSession = (data) => {
  fs.writeFileSync(sessionFile, data);
  console.log(
    `Session saved to ${sessionFile}. You can login next time without code.`,
  );
};

const stringSession = new StringSession(sessionString);

(async () => {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("number ?"),
    password: async () => await input.text("password?"),
    phoneCode: async () => await input.text("Code ?"),
    onError: (err) => console.log(err),
  });

  console.log("You are now connected.");
  updateSession(client.session.save());

  const participants = Array.from(
    await client.getParticipants(groupId, { limit: PARTICIPANT_LIMIT }),
    (user) => ({
      id: user.id.valueOf(),
      username: user.username,
      first_name: user.firstName,
      last_name: user.lastName,
      phone: user.phone,
    }),
  );

  // Prettier console output
  console.table(participants);

  // Convert JSON array to CSV and write to a file
  const csv = parse(participants);
  fs.writeFileSync(CSV_OUTPUT, csv);
  console.log(`Participant data has been written to ${CSV_OUTPUT}`);

  await client.disconnect();
  process.exit(0);
})().catch(console.error);
