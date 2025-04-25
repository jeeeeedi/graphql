document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Encode credentials in Base64 for Basic Authentication
    const credentials = btoa(`${username}:${password}`);

    try {
        // Fetch JWT from the signin endpoint
        const response = await fetch('https://01.gritlab.ax/api/auth/signin', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`
            }
        });

        if (!response.ok) {
            throw new Error('Invalid credentials');
        }

        const data = await response.json();
        const jwt = data.token; // Assuming the token is returned as `token`

        // Use the JWT to fetch GraphQL data
        fetchGraphQL(jwt);
    } catch (error) {
        document.getElementById('errorMessage').textContent = error.message;
    }
});



function fetchGraphQL(jwt) {
    const query = `
  query {
  user {
    id
    login
  }
}
`;

    fetch('https://01.gritlab.ax/api/graphql-engine/v1/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}` // Add the JWT here
        },
        body: JSON.stringify({ query })
    })
        .then(res => res.json())
        .then(data => {
            console.log("fetchedData:", data);
            const stats = document.getElementById('stats');
           stats.innerHTML = data;
           /*   data.data.users.forEach(user => {
                const statDiv = document.createElement('div');
                statDiv.textContent = `ID: ${user.id}, Name: ${user.login}`;
                stats.appendChild(statDiv);
            }); */
        })
        .catch(error => console.error('Error:', error));
}
