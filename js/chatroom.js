window.onload = webLoaded;

async function webLoaded() {
    if (getCookie('userid') === '') {
        window.location.href = 'login.html';
        return;
    }

    loadChatrooms();

    document.querySelector('#profile_username').innerHTML = getCookie('username');
    document.querySelector('#profile_picture').src = `assets/uploads/${getCookie('profilePic')}`;

    document.querySelector('.message_input_send_button').onclick = sendMessage;

    document.querySelector('.message_input').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            document.querySelector('.message_input_send_button').click();
        }
    });

    document.querySelector('#create_chatroom').addEventListener('click', function() {
        window.location.href = 'createchat.html';
    });
    
    document.querySelector('.logout_button').addEventListener('click', function() {
        clearCookie('userid');
        clearCookie('username');
        clearCookie('profilePic');
        window.location.href = 'login.html';
    });

    document.querySelector('#like').addEventListener('click', function() {
        likeChatroom(getCookie('chatroomId'));
    });

    document.querySelector('#leave_button').addEventListener('click', function() {
        leaveChatroom(getCookie('chatroomId'));
    });

    document.querySelector('#profile_picture').addEventListener('click', function() {
        window.location.href = 'profile.html?userid=' + getCookie('userid');
    });

    document.querySelector('#profile_username').addEventListener('click', function() {
        window.location.href = 'profile.html?userid=' + getCookie('userid');
    });
}

function setCookie(cname, cvalue, exdays) {
    let d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    let expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
    let name = cname + "=";
    let ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function clearCookie(cname) {
    document.cookie = cname + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
}

function checkCookie() {
    let user = getCookie("username");
    if (user != "") {
        alert("Welcome again " + user);
    } else {
        user = prompt("Please enter your name:", "");
        if (user != "" && user != null) {
            setCookie("username", user, 365);
        }
    }
}

async function sendMessage() {
    const message = document.querySelector('.message_input').value;
    if (message === '') {
        return;
    }

    // Send post request to server to send message to a specific chatroom
    const response = await fetch('/chatroom/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
    });

    if (!response.ok) {
        console.error('Failed to send message');
        return;
    }

    document.querySelector('.message_input').value = '';
    loadMessages(getCookie('chatroomId'));
}

function setCurrentChatroom(chat) {
    let chatroomId = chat.chatroomid;
    let chatname = chat.chatroomName;
    let chatpic = chat.chatroomPic;
    let chatbg = chat.chatroomBG;
    let chatlike = chat.isLiked === 1;
    
    setCookie('chatroomId', chatroomId, 1);

    // Rename the chatroom name at the top to the chatroom we're currently in.
    const chatroomName = document.querySelector('#chatroom_title');
    chatroomName.innerHTML = chatname;

    // Change the background image of the chatroom
    const chatroomBG = document.querySelector('.chatroom_message_container');
    chatroomBG.style.backgroundImage = `url('assets/uploads/${chatbg}')`;

    const chatroomBG2 = document.querySelector('.chatroom_nav');
    chatroomBG2.style.backgroundImage = `url('assets/uploads/${chatpic}')`;

    // Did we like this chatroom?
    const likeButton = document.querySelector('#like');
    likeButton.src = chatlike ? 'assets/images/liked.png' : 'assets/images/unliked.png';

    document.querySelector('#profile_picture').addEventListener('click', function() {
        window.location.href = 'profile.html?userid=' + getCookie('userid');
    });

    document.querySelector('#profile_username').addEventListener('click', function() {
        window.location.href = 'profile.html?userid=' + getCookie('userid');
    });

    loadMessages(chatroomId);
}

async function loadMessages(chatroomId) {
    let messages = await fetchMessages(chatroomId);

    // Fetch members of the chatroom, so we can display their profile pictures.
    let members = await fetchMembers(chatroomId);

    const messagesContainer = document.querySelector('.chatroom_message_container');
    const textInputContainer = document.querySelector('.message_input_container');
    
    messagesContainer.innerHTML = ''; // Clear existing messages
    messages.forEach(msg => {
        // Match the member to the message
        const member = members.find(member => member.userid === msg.userid);
        if (member === undefined) {
            console.error('Failed to find member for message:', msg);
            return;
        }
        
        const messageDiv = document.createElement('div');

        // If we're the one who sent the message, use the right class
        // messageDiv.className = 'chatroom_message left';
        if (msg.userid == getCookie('userid')) {
            messageDiv.className = 'chatroom_message right';
        } else {
            messageDiv.className = 'chatroom_message left';
        }

        const profilePic = document.createElement('img');
        profilePic.src = `assets/uploads/${member.profilePic}`;
        profilePic.alt = msg.username;
        profilePic.className = 'chatroom_message_content profilepic';
        profilePic.style.cursor = 'pointer';
        profilePic.addEventListener('click', function() {
            window.location.href = 'profile.html?userid=' + member.userid;
        });

        const contentDiv = document.createElement('div');
        contentDiv.className = 'chatroom_message_content';

        const messageContent = document.createElement('div');
        messageContent.className = 'chatroom_message_content message';
        messageContent.innerHTML = msg.content;

        const usernameDiv = document.createElement('div');
        usernameDiv.className = 'chatroom_message_content username';
        usernameDiv.innerHTML = member.username;

        contentDiv.appendChild(messageContent);
        contentDiv.appendChild(usernameDiv);
        messageDiv.appendChild(profilePic);
        messageDiv.appendChild(contentDiv);
        messagesContainer.appendChild(messageDiv);
    });

    messagesContainer.scrollTo(0, messagesContainer.scrollHeight - textInputContainer.clientHeight);
}

async function loadChatrooms() {
    let chats = await fetchChatrooms();
    // Display chatrooms in the UI. Search for "side_contents" and add stuff inside
    const sideContents = document.querySelector('.side_contents');
    chats.forEach(chat => {
        const button = document.createElement('button');
        button.textContent = chat.chatroomName;
        button.style.backgroundImage = `url('assets/uploads/${chat.chatroomPic}')`;
        button.style.backgroundSize = 'cover';
        button.style.backgroundPosition = 'center';
        button.className = 'chatroom_button';
        button.onclick = () => setCurrentChatroom(chat);
        sideContents.appendChild(button);
    });

    // Check ?chatroomId= in the URL for a specific chatroom to load
    const urlParams = new URLSearchParams(window.location.search);
    const urlID = urlParams.get('chatroomid');
    if (urlID !== null) {
        const chat = chats.find(chat => chat.chatroomid == urlID);
        if (chat !== undefined) {
            setCurrentChatroom(chat);
            return;
        }
    }

    // Load the first chatroom by default
    if (chats.length > 0) {
        setCurrentChatroom(chats[0]);
        return;
    }
}

async function fetchMessages(chatroomId) {
    if (typeof chatroomId === 'undefined' || chatroomId === null || chatroomId < 0) {
        console.error('Invalid chatroomId:', chatroomId);
        return [];
    }

    try {
        const response = await fetch('/chatroom/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ chatroomId: chatroomId }),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching messages:', error);
        return [];
    }
}

async function fetchMembers(chatroomId) {
    try {
        const response = await fetch('/chatroom/members', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ chatroomId: chatroomId }),
        });
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch members:', error);
        return [];
    }
}

async function fetchChatrooms() {
    try {
        // Send post request to server to fetch chatrooms we're currently in.
        const response = await fetch('/chatroom/personal', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const chatrooms = await response.json();
        return chatrooms;
    } catch (error) {
        console.error('Failed to fetch chatrooms:', error);
        return [];
    }
}

async function likeChatroom(chatroomId, state) {
    try {
        const response = await fetch('/chatroom/like', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ chatroomId: chatroomId }),
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        // Update the like button
        const likeButton = document.querySelector('#like');
        const chat = await response.json();
        likeButton.src = chat.action === 1 ? 'assets/images/liked.png' : 'assets/images/unliked.png';
    } catch (error) {
        console.error('Failed to like chatroom:', error);
    }
}

async function leaveChatroom(chatroomId) {
    try {
        const response = await fetch('/chatroom/leave', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ chatroomId: chatroomId }),
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        // Redirect to the feed
        window.location.href = 'feed.html';
    } catch (error) {
        console.error('Failed to leave chatroom:', error);
    }
}