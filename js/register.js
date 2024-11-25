window.onload = pageLoad;

function pageLoad(){
    displayError();
}

// Function to get URL parameters
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Function to display error messages
function displayError() {
    const error = getUrlParameter('error');
    const errorMessage = document.getElementById('error_message');
    
    if (!errorMessage) return; // Exit if error message element doesn't exist

    if (error === 'exists') {
        errorMessage.textContent = 'This username / email already exists. Please choose a different one.';
        errorMessage.style.display = 'block';
    } else if (error === 'password') {
        errorMessage.textContent = 'Passwords do not match. Please try again.';
        errorMessage.style.display = 'block';
    } else if (error === 'empty') {
        errorMessage.textContent = 'Please fill in all required fields.';
        errorMessage.style.display = 'block';
    }
}