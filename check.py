import json
import urllib.request
import urllib.parse

# Get token
token_url = "https://oauth2.googleapis.com/token"
data = urllib.parse.urlencode({
    "client_id": "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
    "client_secret": "j9iVZfS8kkCEFUPaAeJV0sAi",
    "refresh_token": "1//0hgxk7djRMg0lCgYIARAAGBESNwF-L9Irk5Q1dNcYW17MyDETvMU96OL5Vl2LFAT-nLGlKeuVTanilAmuc9bgiC5XU_FQQD_9nIE",
    "grant_type": "refresh_token"
}).encode('utf-8')
req = urllib.request.Request(token_url, data=data)
res = urllib.request.urlopen(req)
token = json.loads(res.read())['access_token']

# Query users
query_url = "https://firestore.googleapis.com/v1/projects/silog-opl-681dc/databases/(default)/documents:runQuery"
headers = {"Authorization": "Bearer " + token, "Content-Type": "application/json"}
body = json.dumps({
    "structuredQuery": {
        "from": [{"collectionId": "users"}],
        "where": {
            "fieldFilter": {
                "field": {"fieldPath": "correo_electronico"},
                "op": "EQUAL",
                "value": {"stringValue": "finanzas@silogspa.cl"}
            }
        }
    }
}).encode('utf-8')
req = urllib.request.Request(query_url, data=body, headers=headers)
try:
    res = urllib.request.urlopen(req)
    print("correo_electronico query:")
    print(json.dumps(json.loads(res.read()), indent=2))
except Exception as e:
    print(e)
