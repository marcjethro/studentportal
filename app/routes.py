from app import app

@app.route('/')
def homepage():
    return "Hello, This is Section 2's Student Portal!"
