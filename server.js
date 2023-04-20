const express = require('express');
const clientApp = require('./client.js');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const compression = require('compression');
const { Configuration, OpenAIApi } = require("openai");
const jwt = require('jsonwebtoken');
require("dotenv").config();

const app = express();

// Middleware configuration
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const allowedOrigins = ['https://www.subsect.ca', 'https://167.114.138.186:5001'];

app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified origin: ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));
// Database configuration
const url = 'mongodb://localhost:27017/imagen-gpt';
const userSchema = mongoose.Schema({
  email: String,
  password: String,
  isAdmin: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false },
  images: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Image' }]
});
const User = mongoose.model('User', userSchema);
const imageSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  email: { type: String },
  url: String,
  description: String
});
const Image = mongoose.model('Image', imageSchema);

// OpenAI configuration
const openaiConfig = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(openaiConfig);
const engineId = 'stable-diffusion-xl-beta-v2-2-2';
const apiHost = process.env.API_HOST || 'https://api.stability.ai';
const apiKey = process.env.STABILITY_API_KEY;
const prePrompt = process.env.PRE_PROMPT;

// HTTPS configuration
const privateKey = fs.readFileSync('privatekey.pem', 'utf8');
const certificate = fs.readFileSync('certificate.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };
// ... (existing app configuration)
function isAuthenticated(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}
function isAdmin(req, res, next) {
  const userId = req.user.userId;
  User.findById(userId, (err, user) => {
    if (err) {
      return res.status(500).send('Internal Server Error');
    }
    if (!user) {
      return res.status(404).send('User not found');
    }
    if (user.isAdmin) {
      next();
    } else {
      return res.status(403).send('Forbidden: You do not have admin privileges');
    }
  });
}

app.post('/api/create-user', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = new User({ email, password });
    await user.save();
    console.log('User created successfully');
    res.send();
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});



app.post('/api/login', async (req, res) => {
  const findUser = {
    email: req.body.email,
    password: req.body.password,
  };
  console.log("loggin attempted")
  try {
    const user = await User.findOne(findUser);
    if (user) {
      // Generate JWT token
      const payload = {
        userId: user._id,
        email: user.email,
      };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

      const data = {
        message: 'Logged in',
        token: token,
      };
      res.cookie('jwt', token);
      res.json(data);
    } else {
      res.status(401).send('Login failed');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});


app.post('/api/register', async (req, res) => {
  const newUser = new User({
    email: req.body.email,
    password: req.body.password,
  });

  try {
    // Check if the email is already registered
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).send('Email already registered');
    }

    // Save the new user to the database
    const savedUser = await newUser.save();

    // Generate JWT token
    const payload = {
      userId: savedUser._id,
      email: savedUser.email,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    const data = {
      message: 'Registered and logged in',
      token: token,
    };
    res.cookie('jwt', token);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});


app.post('/generate', isAuthenticated, async (req, res) => {
  try {
    const prompt = req.body.prompt;
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [{ role: "assistant", content: prePrompt }, { role: "user", content: " you are a ai art image generation prompt expert enhance this prompt for image generation " + prompt }],
      max_tokens: 200,
    });

    const enhancedPrompt = completion.data.choices[0].message.content;
    console.log(enhancedPrompt);


    if (!apiKey) throw new Error('Missing Stability API key.');

    const response = await axios.post(
      `${apiHost}/v1/generation/${engineId}/text-to-image`,
      {
        text_prompts: [
          {
            text: enhancedPrompt,
          },
        ],
        cfg_scale: 7,
        clip_guidance_preset: 'FAST_BLUE',
        height: 512,
        width: 512,
        samples: 1,
        steps: 50,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (response.status !== 200) {
      throw new Error(`Non-200 response: ${response.data}`);
    }

    const base64Image = response.data.artifacts[0].base64;
    const bufferImage = Buffer.from(base64Image, 'base64');

    const email = req.user.email;
    const user = await User.findOne({ email });

    if (!user) {
      console.error('User not found');
      return res.status(404).send('User not found');
    }

    // Save the image to the server
    const extension = ".png";
    const fileName = `${Date.now()}${extension}`;
    const dirPath = path.join(__dirname, 'public', 'images', user._id.toString());
    const filePath = path.join(dirPath, fileName);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(filePath, bufferImage);

    // Save the image data to the database
    const imageUrl = "https://167.114.138.186:5000" + `/public/images/${user._id.toString()}/${fileName}`;
    const image = new Image({
      user: user._id,
      url: imageUrl,
      description: enhancedPrompt,
      email: email
    });
    await image.save();

    user.images.push(image._id);
    await user.save();

    return res.json({ url: imageUrl, description: enhancedPrompt });
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

app.delete('/delete/:id', isAuthenticated, async (req, res) => {
  try {
    const email = req.user.email;
    const userId = req.user.userId;
    const id = req.params.id;
    const image = await Image.findById(id).exec();
    if (!image) {
      console.error('Image not found');
      return res.status(404).send('Image not found');
    }
    const user = await User.findById(userId).exec();
    if (!user) {
      console.error('User not found');
      return res.status(404).send('User not found');
    }
    if (image.user.toString() !== userId) {
      console.error('Unauthorized deletion attempt');
      return res.status(403).send('Unauthorized deletion attempt');
    }
    // Remove the image from the database
    await Image.deleteOne({ _id: id }).exec();
    return res.sendStatus(200);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});



app.get('/gallery', isAuthenticated, async (req, res) => {
  try {
    const email = req.user.email;
    const user = await User.findOne({ email });

    if (!user) {
      console.error('User not found');
      return res.status(404).send('User not found');
    }

    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
    const skip = (page - 1) * itemsPerPage;

    const images = await Image.find({ user: user._id })
      .skip(skip)
      .limit(itemsPerPage)
      .sort({ _id: -1 });

    const formattedImages = images.map(image => {
      return { id: image._id, url: image.url, description: image.description };
    });

    return res.json(formattedImages);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});


app.get('/admin/users', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});
app.post('/admin/user/:userId/toggle-ban', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      res.status(404).send('User not found');
    } else {
      user.isBanned = !user.isBanned;
      await user.save();
      res.send('User ban status updated');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

const httpsServer = https.createServer(credentials, app);

mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to database');
    
    https.createServer(credentials, app).listen(5001, () => console.log('Main server listening on port 5001...'));

    clientApp.listen(5000, () => console.log(`Client listening on port 5000...`));
  })
  .catch((err) => {
    console.error(err);
  });
