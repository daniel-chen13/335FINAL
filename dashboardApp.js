const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const readline = require('readline');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const app = express();
const axios = require('axios');

const apiKeyNASA = 'OMV6dqlqLJUtRljYHTyoHHJ7KPDcxIBCzP9jiQC3';
const apiURLNASA = 'https://api.nasa.gov/planetary/apod?api_key=' + apiKeyNASA;

const apiKeyNews = '237a124a9e764012b289eaf6dc58afe5';
const apiURLNews = 'https://newsapi.org/v2/top-headlines?country=us&apiKey=' + apiKeyNews;

let nickname_of_user = "";

const {
    MONGO_DB_USERNAME,
    MONGO_DB_PASSWORD,
    MONGO_DB_NAME,
} = process.env;

const mongoUrl = `mongodb+srv://${MONGO_DB_USERNAME}:${MONGO_DB_PASSWORD}@cluster0.ia5bo31.mongodb.net/${MONGO_DB_NAME}?retryWrites=true&w=majority`;

const client = new MongoClient(mongoUrl, { serverApi: ServerApiVersion.v1 });

async function connectToDatabase() {
    try {
      await client.connect();
      console.log('Connected to MongoDB');
    } catch (err) {
      console.error('Error connecting to MongoDB:', err);
    }
}

connectToDatabase();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'views')));

app.get('/', (req, res) => {
    res.render('login');
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    try {
        const { username, password, nickname } = req.body;

        const db = client.db(MONGO_DB_NAME);
        const users = db.collection('dashboardCredentials');
        const nicknames = db.collection('dashboardUserData');

        const user = await users.findOne({ username });

        if (user) {
            res.status(409).send('User already exists');
        } else {
            const result = await users.insertOne({ username, password });
            const result2 = await nicknames.insertOne({ username, nickname, reminders: [] });
            res.redirect('/login');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const db = client.db(MONGO_DB_NAME);
        const nicknames = db.collection('dashboardUserData');
        const credentials = db.collection('dashboardCredentials');
        
        const entry = await nicknames.findOne({ username });
        const check = await credentials.findOne({ username });

        if (entry && check && (check.password === password)) {
            const { nickname } = entry;

            // Redirect to dashboard with query parameter
            const encodedNickname = encodeURIComponent(nickname);
            return res.redirect(`/dashboard?data=${encodedNickname}`);
        } else {
            res.status(401).send('Invalid username or password -- <a href="/login">Go back to Login Page</a>. Try again or go to <a href="register">Register page</a> to create an account.');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/dashboard', async (req, res) => {

    const db = client.db(MONGO_DB_NAME);
    const nicknames = db.collection('dashboardUserData');
        
    const entry = await nicknames.findOne({ nickname: req.query.data });

    const { nickname, reminders } = entry;
    nickname_of_user = nickname;
    var url = "";
    await axios.get(apiURLNASA, {
        headers: {
          Authorization: `Bearer ${apiKeyNASA}`,
        },
      })
        .then(response => {
          console.log('API response:', response.data);
          url = response.data.url;
        })
        .catch(error => {
          console.error('Error fetching data:', error);

        });

    var headlineTitle = "";
    var headlineLink = "";

    await axios.get(apiURLNews, {
        headers: {
            Authorization: `Bearer ${apiKeyNews}`,
        },
        })
        .then(response => {
            // console.log('API response:', response.data);
            headlines = response.data.articles;
            const randomIndex = Math.floor(Math.random() * headlines.length);
            const randomArticle = headlines[randomIndex];
            headlineTitle = randomArticle.title;
            headlineLink = randomArticle.url;
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });

    let arrayString = '';
    for (let i = 0; i < entry.reminders.length; i++) {
        arrayString += '<li>' + entry.reminders[i] + '</li>';
    }
    res.render('dashboard', { nickname: req.query.data, reminderList: arrayString, nasaURL: url, headlineTitle: headlineTitle, headlineLink: headlineLink});

});

app.post('/dashboard', async (req, res) => {
    const newReminder = req.body.reminder;

    const db = client.db(MONGO_DB_NAME);
    const nicknames = db.collection('dashboardUserData');
        
    const entry = await nicknames.findOne({ nickname: nickname_of_user });

    const { reminders } = entry;

    reminders.push(newReminder);

    await nicknames.updateOne(
        { nickname: nickname_of_user },
        { $set: { reminders: reminders } }
    );
    
});

function promptToStopServer() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Stop to shutdown the server: ', (answer) => {
        if (answer.toLowerCase() === 'stop') {
            server.close(() => {
                console.log('Shutting down the server');
                rl.close();
                process.exit(0);
            });
        } else {
            console.log('Invalid command. Server continues running.');
            rl.close();
            promptToStopServer();
        }
    });

    rl.on('close', () => {
        process.exit(0);
    });
}

const port = process.argv[2] || 3000;

const server = app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    promptToStopServer();
});
