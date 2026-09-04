from flask import request
from app import app, db
from app.models import User

@app.route('/')
def homepage():
    return "Hello, This is Section 2's Student Portal!"

@app.route('/users')
def getUsers():
    return [user.username for user in db.session.scalars(db.select(User)).all()]

@app.route('/addUser')
def addUser():
    username = request.args.get("username", default="", type=str)
    if username:
        try:
            new_user = User(username=username)
            db.session.add(new_user)
            db.session.commit()
            return f"Successfully Added User: {username}!"
        except Exception as e:
            db.session.rollback()
            return str(e)
    else:
        return "No username provided!"
