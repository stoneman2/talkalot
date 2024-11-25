const express = require('express');
const app = express();
const fs = require('fs');
const hostname = 'localhost';
const port = 3000;
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql');
const cookieParser = require('cookie-parser');
const multer = require('multer');

app.use(express.static(__dirname));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());

const con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "talkalot"
})

function queryDB(sql) {
    return new Promise((resolve, reject) => {
        con.query(sql, (err, result, fields) => {
            if (err) reject(err);
            else
                resolve(result);
        })
    })
}

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
      callback(null, 'assets/uploads/');
    },

    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
  });

const imageFilter = (req, file, cb) => {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF)$/)) {
        req.fileValidationError = 'Only image files are allowed!';
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};

const upload = multer({ storage: storage });

app.post('/chatroom/messages', async (req, res) => {
    const chatroomId = req.body.chatroomId;

    if (typeof chatroomId === 'undefined' || chatroomId === null || chatroomId < 0) {
        res.status(400).json({ success: false, message: 'Invalid chatroom ID' });
        return;
    }

    try {
        const messages = await queryDB(`SELECT * FROM messages WHERE chatroomid = ${con.escape(chatroomId)}`);
        res.json(messages);
    } catch (error) {
        console.error('Failed to fetch messages:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch messages' });
    }
});

app.post('/chatroom/members', async (req, res) => {
    const chatroomId = req.body.chatroomId;

    if (typeof chatroomId === 'undefined' || chatroomId === null || chatroomId < 0) {
        res.status(400).json({ success: false, message: 'Invalid chatroom ID' });
        return;
    }

    try {
        const chatmembers = await queryDB(`SELECT users.userid, users.username, users.profilePic FROM chat_members JOIN users ON chat_members.userid = users.userid WHERE chat_members.chatroomid = ${con.escape(chatroomId)}`);
        res.json(chatmembers);
    } catch (error) {
        console.error('Failed to fetch members:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch members' });
    }
});

app.post('/chatroom/create', upload.fields([{ name: 'main-picture' }, { name: 'background-picture' }]), async (req, res) => {
    const chatName = req.body['chat-name'];
    const mainPicture = req.files['main-picture'][0].filename;
    const userid = req.cookies['userid'];
    
    const backgroundPicture = req.files['background-picture'] ? req.files['background-picture'][0].filename : 'default-background.png';

    try {
        await queryDB(`INSERT INTO chats (chatroomName, chatroomPic, chatroomBG, userid) VALUES (${con.escape(chatName)}, ${con.escape(mainPicture)}, ${con.escape(backgroundPicture)}, ${con.escape(userid)})`);
        
        // Put the owner of the chatroom in the chatroom as well!
        await queryDB(`INSERT INTO chat_members (chatroomid, userid) VALUES (LAST_INSERT_ID(), ${con.escape(userid)})`);
        const newChatResult = await queryDB('SELECT LAST_INSERT_ID() as id');
        res.redirect('/chatroom.html?chatroomid=' + newChatResult[0].id);
    } catch (error) {
        console.error('Failed to create chatroom:', error);
        res.status(500).json({ success: false, message: 'Failed to create chatroom' });
    }
});

// Grabs every single chatroom that the user is in
app.post('/chatroom/personal', async (req, res) => {
    const userid = req.cookies['userid'];
    try {
        const chatrooms = await queryDB(`
            SELECT 
            chats.chatroomid, 
            chats.chatroomName, 
            chats.chatroomPic, 
            chats.chatroomBG, 
            users.username as ownerUsername,
            EXISTS (
                SELECT 1 FROM likes 
                WHERE likes.chatroomID = chats.chatroomid 
                AND likes.userid = ${con.escape(userid)}
            ) as isLiked
            FROM chat_members 
            JOIN chats ON chat_members.chatroomid = chats.chatroomid 
            JOIN users ON chats.userid = users.userid 
            WHERE chat_members.userid = ${con.escape(userid)}
        `);
        res.json(chatrooms);
        // Let's fetch every chatroom that the user is in by the IDs we got from the previous query
    } catch (error) {
        console.error('Failed to fetch chatrooms:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch chatrooms' });
    }
});

// Grabs every single chatroom, the top 10 most popular ones at least, for the feed.
app.post('/chatroom/feed', async (req, res) => {
    try {
        const chatrooms = await queryDB(`
            SELECT 
            chats.chatroomid, 
            chats.chatroomName, 
            chats.chatroomPic, 
            chats.chatroomBG, 
            users.username as ownerUsername, 
            COUNT(DISTINCT chat_members.userid) as memberCount,
            COUNT(DISTINCT likes.userid) as likeCount
            FROM chats 
            JOIN users ON chats.userid = users.userid 
            LEFT JOIN chat_members ON chats.chatroomid = chat_members.chatroomid 
            LEFT JOIN likes ON chats.chatroomid = likes.chatroomID
            GROUP BY chats.chatroomid 
            ORDER BY memberCount DESC, likeCount DESC 
            LIMIT 30
        `);
        res.json(chatrooms);
    } catch (error) {
        console.error('Failed to fetch chatrooms:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch chatrooms' });
    }
});

// Grab a person's chatroom
app.post('/chatroom/profile', async (req, res) => {
    const userid = req.body.userid;
    try {
        const chatrooms = await queryDB(`
            SELECT 
            chats.chatroomid, 
            chats.chatroomName, 
            chats.chatroomPic, 
            chats.chatroomBG, 
            users.username as ownerUsername,
            COUNT(DISTINCT cm.userid) as memberCount,
            COUNT(DISTINCT likes.userid) as likeCount
            FROM chats 
            JOIN users ON chats.userid = users.userid 
            JOIN chat_members ON chats.chatroomid = chat_members.chatroomid 
            LEFT JOIN chat_members cm ON chats.chatroomid = cm.chatroomid
            LEFT JOIN likes ON chats.chatroomid = likes.chatroomID
            WHERE chat_members.userid = ${con.escape(userid)}
            GROUP BY chats.chatroomid 
            ORDER BY memberCount DESC, likeCount DESC 
            LIMIT 30
        `);
        res.json(chatrooms);
    } catch (error) {
        console.error('Failed to fetch chatrooms:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch chatrooms' });
    }
});

// Send a message to a chatroom
app.post('/chatroom/send', async (req, res) => {
    // const chatroomId = req.body.chatroomId;
    const chatroomId = req.cookies['chatroomId'];
    const message = req.body.message;
    const userid = req.cookies['userid'];

    if (typeof chatroomId === 'undefined' || chatroomId === null || chatroomId < 0) {
        res.status(400).json({ success: false, message: 'Invalid chatroom ID' });
        return;
    }

    if (!message) {
        res.status(400).json({ success: false, message: 'Empty message' });
        return;
    }

    try {
        const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await queryDB(`INSERT INTO messages (chatroomid, userid, content, messageDate) VALUES (${con.escape(chatroomId)}, ${con.escape(userid)}, ${con.escape(message)}, ${con.escape(currentDate)})`);
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to send message:', error);
        res.status(500).json({ success: false, message: 'Failed to send message' });
    }
});

app.post('/user/register', upload.fields([{ name: 'profile-picture' }]), async (req, res) => {
    const username = req.body['username'];
    const email = req.body['email'];
    const password = req.body['password'];

    // check if we have a file, if not, lets set the default profile picture
    if (!req.files['profile-picture']) {
        req.files['profile-picture'] = [{ filename: 'default-profile.png' }];
    }

    const profilePicture = req.files['profile-picture'][0].filename;

    if (!username || !email || !password) {
        res.redirect('/register.html?error=' + encodeURIComponent('empty'));
        return;
    }

    if (password !== req.body['confirm-password']) {
        res.redirect('/register.html?error=' + encodeURIComponent('password'));
        return;
    }

    try {
        await queryDB(`INSERT INTO users (username, email, password, profilePic) 
                VALUES (${con.escape(username)}, ${con.escape(email)}, ${con.escape(password)}, ${con.escape(profilePicture)})`);

        res.redirect('/login.html');
    } catch (error) {
        const errorMessage = error.code === 'ER_DUP_ENTRY' ? 'exists' : 'Registration failed';
        res.redirect('/register.html?error=' + encodeURIComponent(errorMessage));
    }
});

app.post('/user/login', async (req, res) => {
    const email = req.body['username'];
    const password = req.body['password'];

    if (!email || !password) {
        res.redirect('/login.html?error=' + encodeURIComponent('empty'));
        return;
    }

    try {
        let user = await queryDB(`SELECT * FROM users WHERE email = ${con.escape(email)} AND password = ${con.escape(password)}`);

        if (user.length === 0) {
            // If not email, try username!
            user = await queryDB(`SELECT * FROM users WHERE username = ${con.escape(email)} AND password = ${con.escape(password)}`);
            if (user.length === 0) {
                res.redirect('/login.html?error=' + encodeURIComponent('invalid'));
                return;
            }
        }
        loginUser(user, res);
    } catch (error) {
        console.error('Failed to login:', error);
        res.redirect('/login.html?error=' + encodeURIComponent('failed'));
    }
});

app.post('/chatroom/like', async (req, res) => {
    const chatroomId = req.body.chatroomId;
    const userid = req.cookies['userid'];

    try {
        await queryDB(`INSERT INTO likes (chatroomID, userid) VALUES (${con.escape(chatroomId)}, ${con.escape(userid)})`);
        res.json({ success: true, action: 1 });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            // If duplicate, remove the like instead
            try {
                await queryDB(`DELETE FROM likes WHERE chatroomID = ${con.escape(chatroomId)} AND userid = ${con.escape(userid)}`);
                res.json({ success: true, action: 0 });
            } catch (error) {
                console.error('Failed to unlike chatroom:', error);
                res.status(500).json({ success: false, message: 'Failed to unlike chatroom' });
            }
            return;
        }
        console.error('Failed to like chatroom:', error);
        res.status(500).json({ success: false, message: 'Failed to like chatroom' });
    }
});

app.post('/chatroom/join', async (req, res) => {
    const chatroomId = req.body.chatroomid;
    const userid = req.cookies['userid'];

    if (!chatroomId || !userid) {
        res.status(400).json({ success: false, message: 'Missing required parameters' });
        return;
    }

    try {
        await queryDB(`INSERT INTO chat_members (chatroomid, userid) VALUES (${con.escape(chatroomId)}, ${con.escape(userid)})`);
        res.json({ success: true });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            res.json({ success: true, message: 'Already in chatroom', chatroomId });
        }
    }
});

app.post('/chatroom/leave', async (req, res) => {
    const chatroomId = req.body.chatroomId;
    const userid = req.cookies['userid'];

    if (!chatroomId || !userid) {
        res.status(400).json({ success: false, message: 'Missing required parameters' });
        return;
    }

    try {
        await queryDB(`DELETE FROM chat_members WHERE chatroomid = ${con.escape(chatroomId)} AND userid = ${con.escape(userid)}`);
        res.redirect('/feed.html');
    } catch (error) {
        console.error('Failed to leave chatroom:', error);
        res.status(500).json({ success: false, message: 'Failed to leave chatroom' });
    }
});

app.post('/user/profile', async (req, res) => {
    const userid = req.body.userid;

    if (!userid) {
        res.status(400).json({ success: false, message: 'Missing required parameters' });
        return;
    }

    try {
        const user = await queryDB(`SELECT * FROM users WHERE userid = ${con.escape(userid)}`);
        const result = await queryDB(`
            SELECT users.*, 
            (SELECT COUNT(*) FROM likes WHERE userid = ${con.escape(userid)}) as totalLikes,
            (SELECT COUNT(*) FROM chat_members WHERE userid = ${con.escape(userid)}) as totalChats
            FROM users 
            WHERE users.userid = ${con.escape(userid)}`);
        res.json(result[0]);
    } catch (error) {
        console.error('Failed to fetch user:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user' });
    }
});

function loginUser(user, res) {
    res.cookie('userid', user[0].userID);
    res.cookie('username', user[0].username);
    res.cookie('profilePic', user[0].profilepic);
    res.redirect('/chatroom.html');
}

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}/login.html`);
});