const express = require('express');
const cors = require('cors');
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const dotenv = require("dotenv");
const fs = require("fs");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Validate environment variables
if (!process.env.API_ID || !process.env.API_HASH) {
  console.error("Please set the API_ID and API_HASH environment variables.");
  process.exit(1);
}

const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const sessionFile = "session.txt";

// Global client instance
let telegramClient = null;

// Helper function to get or create Telegram client
async function getTelegramClient() {
  if (telegramClient && telegramClient.connected) {
    return telegramClient;
  }

  const sessionString = fs.existsSync(sessionFile)
    ? fs.readFileSync(sessionFile).toString()
    : "";

  const stringSession = new StringSession(sessionString);
  telegramClient = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  return telegramClient;
}

// Helper function to save session
function saveSession(client) {
  try {
    fs.writeFileSync(sessionFile, client.session.save());
    console.log(`Session saved to ${sessionFile}`);
  } catch (error) {
    console.error("Error saving session:", error.message);
  }
}

// Routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Telegram API Server is running' });
});

// Authentication endpoint - initiate login process
app.post('/auth/login', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ 
        error: 'Phone number is required',
        success: false 
      });
    }

    const client = await getTelegramClient();
    
    // Start the authentication process
    await client.start({
      phoneNumber: async () => phoneNumber,
      phoneCode: async () => {
        // This will be handled in a separate endpoint
        throw new Error('CODE_REQUIRED');
      },
      password: async () => {
        throw new Error('PASSWORD_REQUIRED');
      },
      onError: (err) => console.log(err),
    });

    res.json({ 
      success: true,
      message: 'Code sent to your phone',
      requiresCode: true
    });

  } catch (error) {
    if (error.message === 'CODE_REQUIRED') {
      res.json({ 
        success: true,
        message: 'Please provide the verification code',
        requiresCode: true
      });
    } else {
      res.status(500).json({ 
        error: error.message,
        success: false 
      });
    }
  }
});

// Verify code endpoint
app.post('/auth/verify', async (req, res) => {
  try {
    const { phoneNumber, code, password } = req.body;
    
    if (!phoneNumber || !code) {
      return res.status(400).json({ 
        error: 'Phone number and code are required',
        success: false 
      });
    }

    const client = await getTelegramClient();
    
    await client.start({
      phoneNumber: async () => phoneNumber,
      phoneCode: async () => code,
      password: async () => password || '',
      onError: (err) => console.log(err),
    });

    saveSession(client);

    res.json({ 
      success: true,
      message: 'Authentication successful',
      connected: client.connected
    });

  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      success: false 
    });
  }
});

// Get authentication status
app.get('/auth/status', async (req, res) => {
  try {
    const client = await getTelegramClient();
    const isConnected = client.connected;
    
    if (!isConnected && fs.existsSync(sessionFile)) {
      try {
        await client.connect();
      } catch (error) {
        console.log("Could not reconnect with saved session");
      }
    }

    res.json({ 
      connected: client.connected,
      sessionExists: fs.existsSync(sessionFile)
    });

  } catch (error) {
    res.json({ 
      connected: false,
      sessionExists: fs.existsSync(sessionFile),
      error: error.message
    });
  }
});

// Get group participants
app.get('/groups/:groupId/participants', async (req, res) => {
  try {
    const { groupId } = req.params;
    const limit = parseInt(req.query.limit) || 500;
    
    if (!groupId) {
      return res.status(400).json({ 
        error: 'Group ID is required',
        success: false 
      });
    }

    const client = await getTelegramClient();
    
    if (!client.connected) {
      return res.status(401).json({ 
        error: 'Not authenticated. Please login first.',
        success: false 
      });
    }

    const participants = await client.getParticipants(parseInt(groupId), { limit });
    
    const participantData = participants.map(user => ({
      id: user.id.valueOf(),
      username: user.username,
      first_name: user.firstName,
      last_name: user.lastName,
      phone: user.phone,
      isBot: user.bot || false,
      isPremium: user.premium || false
    }));

    res.json({
      success: true,
      count: participantData.length,
      participants: participantData
    });

  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      success: false 
    });
  }
});

// Send message to users
app.post('/messages/send', async (req, res) => {
  try {
    const { userIdentifiers, message } = req.body;
    
    if (!userIdentifiers || !Array.isArray(userIdentifiers) || userIdentifiers.length === 0) {
      return res.status(400).json({ 
        error: 'User identifiers array is required',
        success: false 
      });
    }

    if (!message) {
      return res.status(400).json({ 
        error: 'Message is required',
        success: false 
      });
    }

    const client = await getTelegramClient();
    
    if (!client.connected) {
      return res.status(401).json({ 
        error: 'Not authenticated. Please login first.',
        success: false 
      });
    }

    const results = [];
    
    for (const userIdentifier of userIdentifiers) {
      try {
        // Try to resolve the entity first
        let entity;
        try {
          entity = await client.getEntity(userIdentifier);
        } catch (entityError) {
          results.push({ 
            userIdentifier, 
            status: 'failed', 
            error: `Entity resolution failed: ${entityError.message}` 
          });
          continue;
        }

        // Send the message
        await client.sendMessage(entity, { message });
        results.push({ userIdentifier, status: 'success' });
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        results.push({ 
          userIdentifier, 
          status: 'failed', 
          error: error.message 
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failCount = results.filter(r => r.status === 'failed').length;

    res.json({
      success: true,
      summary: {
        total: userIdentifiers.length,
        successful: successCount,
        failed: failCount
      },
      results
    });

  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      success: false 
    });
  }
});

// Get user info
app.get('/users/:userIdentifier', async (req, res) => {
  try {
    const { userIdentifier } = req.params;
    
    const client = await getTelegramClient();
    
    if (!client.connected) {
      return res.status(401).json({ 
        error: 'Not authenticated. Please login first.',
        success: false 
      });
    }

    const entity = await client.getEntity(userIdentifier);
    
    const userInfo = {
      id: entity.id.valueOf(),
      username: entity.username,
      firstName: entity.firstName,
      lastName: entity.lastName,
      phone: entity.phone,
      isBot: entity.bot || false,
      isPremium: entity.premium || false
    };

    res.json({
      success: true,
      user: userInfo
    });

  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      success: false 
    });
  }
});

// Export participants as CSV
app.get('/groups/:groupId/participants/export', async (req, res) => {
  try {
    const { groupId } = req.params;
    const limit = parseInt(req.query.limit) || 500;
    
    const client = await getTelegramClient();
    
    if (!client.connected) {
      return res.status(401).json({ 
        error: 'Not authenticated. Please login first.',
        success: false 
      });
    }

    const participants = await client.getParticipants(parseInt(groupId), { limit });
    
    const participantData = participants.map(user => ({
      id: user.id.valueOf(),
      username: user.username,
      first_name: user.firstName,
      last_name: user.lastName,
      phone: user.phone
    }));

    // Convert to CSV
    const { parse } = require('json2csv');
    const csv = parse(participantData);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="participants_${groupId}_${Date.now()}.csv"`);
    res.send(csv);

  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      success: false 
    });
  }
});

// Disconnect endpoint
app.post('/auth/disconnect', async (req, res) => {
  try {
    if (telegramClient && telegramClient.connected) {
      await telegramClient.disconnect();
    }
    
    // Optionally remove session file
    if (req.body.clearSession && fs.existsSync(sessionFile)) {
      fs.unlinkSync(sessionFile);
    }

    res.json({ 
      success: true,
      message: 'Disconnected successfully'
    });

  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      success: false 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    success: false 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    success: false 
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  if (telegramClient && telegramClient.connected) {
    await telegramClient.disconnect();
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Telegram API Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;