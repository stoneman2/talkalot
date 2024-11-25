window.onload = webLoaded;

async function webLoaded() {
    if (getCookie('userid') === '') {
        window.location.href = 'login.html';
        return;
    }
    
    loadChatrooms();

    document.querySelector('#profile_username').innerHTML = getCookie('username');
    document.querySelector('#profile_picture').src = `assets/uploads/${getCookie('profilePic')}`;


    document.querySelector('#create_chatroom').addEventListener('click', function() {
        window.location.href = 'createchat.html';
    });
    
    document.querySelector('.logout_button').addEventListener('click', function() {
        clearCookie('userid');
        clearCookie('username');
        clearCookie('profilePic');
        window.location.href = 'login.html';
    });

    document.querySelector('#profile_picture').addEventListener('click', function() {
        window.location.href = 'profile.html?userid=' + getCookie('userid');
    });

    document.querySelector('#profile_username').addEventListener('click', function() {
        window.location.href = 'profile.html?userid=' + getCookie('userid');
    });

    // Get the current html user id
    const urlParams = new URLSearchParams(window.location.search);
    const userid = urlParams.get('userid');

    loadUserProfileRooms(userid);
    loadUserInfo(userid);
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
        // When you click, request to join the chatroom
        button.onclick = () => window.location.href = `chatroom.html?chatroomid=${chat.chatroomid}`;
        sideContents.appendChild(button);
    });
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

async function fetchUserChatroom(userid) {
    try {
        // Send post request to server to fetch chatrooms we're currently in.
        const response = await fetch('/chatroom/profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userid: userid }),
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

async function loadUserProfileRooms(userid) {
    let chatrooms = await fetchUserChatroom(userid);
    const popularContainer = document.querySelector('#profile_feed');

    // Decide the popularity by points. Points = (2 * memberCount) + likeCount
    chatrooms.sort((a, b) => {
        const aPoints = (2 * a.memberCount) + a.likeCount;
        const bPoints = (2 * b.memberCount) + b.likeCount;
        return bPoints - aPoints;
    });

    chatrooms.forEach(chatroom => {
        const feedItem = document.createElement('div');
        feedItem.className = 'feed_item';

        const button = document.createElement('button');
        button.className = 'feed_button';
        button.onclick = () => requestJoinChatroom(chatroom.chatroomid);

        const img = document.createElement('img');
        img.className = 'feed_button_bg';
        img.src = `assets/uploads/${chatroom.chatroomPic}`;
        img.alt = 'Chatroom';

        const content = document.createElement('div');
        content.className = 'feed_button_content';

        const name = document.createElement('span');
        name.className = 'chatroom_name';
        name.textContent = chatroom.chatroomName;

        const stats = document.createElement('div');
        stats.className = 'stats_container';

        const members = document.createElement('span');
        members.className = 'member_count';
        members.textContent = `👥 ${chatroom.memberCount}`;

        const likes = document.createElement('span');
        likes.className = 'like_count';
        likes.textContent = `❤️ ${chatroom.likeCount}`;

        stats.append(members, likes);
        content.append(name, stats);
        button.append(img, content);
        feedItem.appendChild(button);
        popularContainer.appendChild(feedItem);
    });
}

async function loadUserInfo(userid) {
    let user = await fetchUserInfo(userid);
    document.querySelector('#profile_name').innerHTML = user.username;
    document.querySelector('#large_profile_pic').src = `assets/uploads/${user.profilepic}`;
    const totalrooms = user.totalChats;
    const totallikes = user.totalLikes;

    const statsString = `🏠 ${totalrooms} ❤️ ${totallikes}`;
    document.querySelector('#profile_items').innerHTML = statsString;
}

async function fetchUserInfo(userid) {
    try {
        // Send post request to server to fetch chatrooms we're currently in.
        const response = await fetch('/user/profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userid: userid }),
        });
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const user = await response.json();
        return user;
    } catch (error) {
        console.error('Failed to fetch user:', error);
        return [];
    }
}

async function requestJoinChatroom(chatroomid) {
    try {
        // Send post request to server to join chatroom
        const response = await fetch('/chatroom/join', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ chatroomid }),
        });
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        if (data.success) {
            window.location.href = `chatroom.html?chatroomid=${chatroomid}`;
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Failed to join chatroom:', error);
    }
}