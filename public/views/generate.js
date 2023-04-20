function checkLoginStatus() {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem('token');
    if (!token) {
      reject('No token found');
      return;
    }
    resolve();
  });
}
function showMessageModal(message) {
  $('#message-text').text(message);
  const messageModal = new bootstrap.Modal(document.getElementById('message-modal'));
  messageModal.show();
}
const spinner = document.querySelector('.spinner-border');

function showSpinner() {
  spinner.classList.remove('visually-hidden');
}

function hideSpinner() {
  spinner.classList.add('visually-hidden');
}

$(document).ready(function () {

  checkLoginStatus()
    .then((userData) => {
      // User is logged in, continue as normal
    })
    .catch((error) => {
      showMessageModal('Please log in to use this application');
      window.location.href = '/imagen/public/veiws/index.html'; // Redirect to the login page
    });

  $('#generate-form').submit(function (event) {
    event.preventDefault();
    const prompt = $('#prompt').val();
    const token = localStorage.getItem('token');
    showSpinner();
    fetch('https://167.114.138.186:5001/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ prompt }),
    })
      .then((response) => response.json())
      .then((data) => {
        hideSpinner();
        $('#description').html('<strong>Description:</strong> ' + data.description);
        const generatedImage = $('#generated-image');
        generatedImage.attr('src', data.url);
        generatedImage.on('load', function() {
          $('#image-card').show(); // show the card once the image is loaded
        });
        $('#save-image').css('display', 'block');
      })
      .catch((error) => {
        hideSpinner();
        showMessageModal('Failed to generate image');
      });

    

  $('#save-image').click(function () {
    const imageUrl = $('#generated-image').attr('src');
    const description = $('#description').html();

    const token = localStorage.getItem('token');
    fetch('https://167.114.138.186:5001/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ url: imageUrl, description }),
    })
      .then((response) => {
        if (response.ok) {
          showMessageModal('Image saved successfully');
        } else {
          showMessageModal('Failed to save image');
        }
      })
      .catch((error) => {
        showMessageModal('Failed to save image');
      });
  });

  $('#logout-link').click(function () {
    localStorage.removeItem('token');
    showMessageModal('Logged out successfully');
    window.location.href = '/imagen/public/views/index.html'; // Redirect to the home page or login page
  });
});


});