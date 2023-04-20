document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  let currentPage = 1;
  const limit = 12; // Change this to your desired number of items per page
  function showMessageModal(message) {
    $('#message-text').text(message);
    const messageModal = new bootstrap.Modal(document.getElementById('message-modal'));
    messageModal.show();
  }
  function fetchImages(page) {
    fetch(`https://167.114.138.186:5001/gallery?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        if (response.status === 401) {
          showMessageModal('Please log in to use this application');
          window.location.href = '/public/views/index.html'; // Redirect to the login page
        } else {
          showMessageModal('Failed to fetch images');
          window.location.href = '/imagen/public/views/index.html'; // Redirect to the login page
          throw new Error('Failed to fetch images');
          
        }
      }
      return response.json();
    })
    .then(images => {
        const gallery = document.getElementById('image-gallery');
        gallery.innerHTML = '';

        images.forEach(image => {
          const card = document.createElement('div');
          const cardHeader = document.createElement('div');
          const cardBody = document.createElement('div');
          const cardTitle = document.createElement('h5');
          const cardText = document.createElement('p');
          const cardImg = document.createElement('img');
          const deleteButton = document.createElement('button');
          const cardFooter = document.createElement('div');

          card.classList.add('col-lg-3', 'col-md-4', 'col-sm-6', 'mb-4');
          card.classList.add('card', 'text-center');
          cardHeader.classList.add('card-header');
          cardHeader.innerText = `Image ${image.id}`;
          cardBody.classList.add('card-body');
          cardImg.classList.add('card-img-top', 'img-fluid');
          cardImg.src = image.url;
          cardImg.title = image.description;
          cardTitle.classList.add('card-title');
          cardText.classList.add('card-text');
          deleteButton.classList.add('btn', 'btn-danger');
          deleteButton.innerText = 'Delete';
        
          deleteButton.addEventListener('click', () => {
            const id = image.id;
            fetch(`https://167.114.138.186:5001/delete/${id}`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            })
              .then(() => {
                card.remove(); // Remove the card element from the page
              })
              .catch(error => {
                console.error(error);
              });
          });
          cardFooter.classList.add('card-footer', 'text-muted');

          cardText.innerText = `${image.description.replace("<strong>Description:</strong> ","").substring(0, 100)}...`;

          cardBody.appendChild(cardImg);
          cardBody.appendChild(cardTitle);
          cardBody.appendChild(cardText);
          cardFooter.appendChild(deleteButton);

          card.appendChild(cardHeader);
          card.appendChild(cardBody);
          card.appendChild(cardFooter);

          gallery.appendChild(card);
        });

        updatePagination(page);
      })
      .catch(error => {
        console.error(error);
      });
  }

  function updatePagination(page) {
    const prevButton = document.querySelector('.pagination .page-item:first-child');
    const nextButton = document.querySelector('.pagination .page-item:last-child');

    currentPage = page;
    prevButton.classList.toggle('disabled', currentPage === 1);
  }

  $('#logout-link').click(function () {
    localStorage.removeItem('token');
    showMessageModal('Logged out successfully');
    window.location.href = '/imagen/public/views/index.html'; // Redirect to the home page or login page
  });

  document.querySelector('.pagination .page-item:first-child').addEventListener('click', (event) => {
    event.preventDefault();
    if (currentPage > 1) {
      fetchImages(currentPage - 1);
    }
  });

  document.querySelector('.pagination .page-item:last-child').addEventListener('click',

(event) => {
event.preventDefault();
fetchImages(currentPage + 1);
});

fetchImages(currentPage); // Fetch images on page load
});
