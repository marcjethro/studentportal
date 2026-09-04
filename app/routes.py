from app import app

@app.route('/')
def homepage():
    return "Hello, This is Section 2's Student Portal!"

data_store = [
        {"id": 1, "name": "Alice", "role": "Engineer"},
        {"id": 2, "name": "Bob", "role": "Designer"}
        ]

@app.route('/api/whatever')
def whatever():
    return data_store

