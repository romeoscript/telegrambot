# Get Telegram Group Users

This script retrieves the list of members from a specified Telegram group and saves the data in CSV format.

## Installation

1. Clone this repository.
2. Install dependencies:

```sh
npm install
```

3. Copy the `.env.example` file and rename it to `.env`: `cp .env.example .env`

4. Set up your `.env` file with the following variables:

```sh
# Create your app here: https://my.telegram.org/apps ; you'll get an API ID and an API hash
# Use incognito mode and disable adblockers to avoid issues
API_ID=your_telegram_api_id
API_HASH=your_telegram_api_hash

# here's how to get your group id: https://neliosoftware.com/content/help/how-do-i-get-the-channel-id-in-telegram/
# don't forget the minus sign!
GROUP_ID=your_group_id
```

You can get your API ID and API Hash from the [Telegram Developer portal](https://my.telegram.org/apps). The Group ID is the ID of the [Telegram group](https://neliosoftware.com/content/help/how-do-i-get-the-channel-id-in-telegram/) you want to extract members from.

## Usage

1. Run the script:

```sh
node script.js
```

2. Follow the prompts to enter your phone number and the code that Telegram sends to your device. If your account has two-factor authentication enabled, you will also need to enter your password.
3. After the script runs, it will save a session file (`session.txt`) for future logins.
4. The list of group members will be printed in the console and also saved to `participants.csv`.

## Dependencies

- [telegram](https://www.npmjs.com/package/telegram)
- [dotenv](https://www.npmjs.com/package/dotenv)
- [input](https://www.npmjs.com/package/input)
- [json2csv](https://www.npmjs.com/package/json2csv)
