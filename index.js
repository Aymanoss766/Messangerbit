const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Page Access Token and OpenAI API Key
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Webhook Verification for Messenger
app.get('/webhook', (req, res) => {
    let VERIFY_TOKEN = process.env.VERIFY_TOKEN;
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('Webhook verified');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// Webhook to receive messages
app.post('/webhook', async (req, res) => {
    let body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(async function(entry) {
            let webhook_event = entry.messaging[0];
            let sender_psid = webhook_event.sender.id;

            if (webhook_event.message) {
                let message = webhook_event.message.text;
                let response = await getAIResponse(message);
                sendTextMessage(sender_psid, response);
            }
        });
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// Send message back to Messenger
const sendTextMessage = (sender_psid, response) => {
    let request_body = {
        recipient: {
            id: sender_psid
        },
        message: {
            text: response
        }
    };

    axios.post(`https://graph.facebook.com/v12.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, request_body)
    .then(() => {
        console.log('Message sent!');
    }).catch(error => {
        console.error('Unable to send message:', error);
    });
};

// Get response from OpenAI API
const getAIResponse = async (message) => {
    try {
        const result = await axios.post('https://api.openai.com/v1/completions', {
            model: "text-davinci-003",
            prompt: message,
            max_tokens: 150
        }, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            }
        });
        return result.data.choices[0].text.trim();
    } catch (error) {
        console.error('OpenAI API Error:', error);
        return "Sorry, I couldn't process your request.";
    }
};

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
