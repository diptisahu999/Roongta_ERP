/** @odoo-module **/

console.log("🚀 Dograh Voice Widget Initialization Started!");

function loadDograhWidget(userToken, userName, userEmail) {
    (function(d, s, id) {
        var js, fjs = d.getElementsByTagName(s)[0];
        if (d.getElementById(id)) return;
        js = d.createElement(s); js.id = id;
        
        var widgetUrl = 'https://dograhai.techvizor.in/embed/dograh-widget.js?token=emb_l_VVC61l9Tnno5kjxsTx6WP8dXUhacyq98VswaPMPkc&environment=local&apiEndpoint=https://dograhaibackend.techvizor.in';
        
        // Append the Odoo user info to the URL
        if (userToken) {
            widgetUrl += '&odoo_token=' + encodeURIComponent(userToken) + 
                         '&user_name=' + encodeURIComponent(userName) + 
                         '&user_email=' + encodeURIComponent(userEmail);
        }
                 
        js.src = widgetUrl;
        js.async = true;
        fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'dograh-widget'));
}

// Automatically call your custom Odoo API to get the user's Token
fetch('/api/profile')
  .then(response => {
      if (!response.ok) throw new Error("Not logged in");
      return response.json();
  })
  .then(data => {
      // Our REST API returns: {"status": "success", "data": {...}}
      if (data.data && data.data.api_token) {
          console.log("✅ Odoo User Profile Fetched! API Token:", data.data.api_token);
          console.log("👤 Full User Profile:", data.data);
          
          loadDograhWidget(
              data.data.api_token, 
              data.data.name || '', 
              data.data.email || ''
          );
      } else {
          console.log("⚠️ Logged in, but no API Token found in response:", data);
          loadDograhWidget('', '', '');
      }
  })
  .catch(err => {
      console.log("ℹ️ No active user session for Voice Agent.");
      loadDograhWidget('', '', '');
  });
