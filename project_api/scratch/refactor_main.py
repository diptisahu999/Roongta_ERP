import re
import sys

file_path = r"c:\Project\odoo18\Roongta_ERP\project_api\controllers\main.py"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add _authenticate_api helper
auth_helper = """
def _authenticate_api():
    \"\"\"
    Authenticates the API request using either an API token (Bearer header)
    or an active Odoo session. Returns the uid on success, or raises an Exception.
    \"\"\"
    auth_header = request.httprequest.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        user = request.env['res.users'].sudo().search([('api_token', '=', token)], limit=1)
        if user:
            return user.id
        raise Exception("Invalid API Token")
    
    # Fallback to session
    if request.session.uid:
        return request.session.uid
        
    raise Exception("Unauthorized: Please provide an API Token or log in.")

"""

# Insert auth_helper after _parse_body
content = content.replace("def _parse_body():", auth_helper + "def _parse_body():")

# 2. Add /api/login endpoint
login_endpoint = """
    # -----------------------------------------------------------------------
    # AUTHENTICATION endpoint
    # -----------------------------------------------------------------------

    @http.route('/api/login', type='http', auth='public', methods=['POST'], csrf=False, cors='*')
    def api_login(self, **kwargs):
        try:
            body = _parse_body()
            db = body.get('db')
            login = body.get('login')
            password = body.get('password')
            
            if not db or not login or not password:
                return _error("db, login, and password are required fields")
                
            uid = request.session.authenticate(db, login, password)
            if not uid:
                return _error("Invalid credentials", status=401)
                
            user = request.env['res.users'].sudo().browse(uid)
            if not user.api_token:
                user.generate_api_token()
                
            return _success({
                'uid': uid,
                'name': user.name,
                'api_token': user.api_token,
                'session_id': request.session.sid,
            })
        except Exception as e:
            return _error(str(e), status=500)

"""

content = content.replace("class ProjectApiController(http.Controller):", "class ProjectApiController(http.Controller):\n" + login_endpoint)

# 3. Modify all endpoints to use _authenticate_api
# We look for "try:\n" inside endpoints and replace with "try:\n            uid = _authenticate_api()\n"
# BUT we must skip the api_login endpoint we just inserted, which is fine since we do it via regex on the original endpoints.
# Actually, it's easier to just do a regex replace on the original content, then insert the login endpoint.

# Let's rebuild the content modifications:
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("def _parse_body():", auth_helper + "def _parse_body():")

# Replace "try:" with "try:\n            uid = _authenticate_api()" in all route methods
# We can find all route definitions: @http.route(...) \n def ... \n try:
def inject_auth(match):
    return match.group(1) + "try:\n            uid = _authenticate_api()\n"

content = re.sub(r'(@http\.route[^\n]+\n\s+def [^\n]+\n(?:\s+"""[\s\S]*?"""\n)?\s+)try:\n', inject_auth, content)

# Now inject the login endpoint which we DON'T want to have `uid = _authenticate_api()` inside its try block.
content = content.replace("class ProjectApiController(http.Controller):", "class ProjectApiController(http.Controller):\n" + login_endpoint)

# 4. Replace .with_user(SUPERUSER_ID) with .with_user(uid)
# Wait, some places might have .sudo() instead. In the existing file, it's .with_user(SUPERUSER_ID).
content = content.replace(".with_user(SUPERUSER_ID)", ".with_user(uid)")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Refactoring complete.")
