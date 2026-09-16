import re
import string
import secrets

from werkzeug.security import generate_password_hash
from flask import jsonify, request, send_from_directory, render_template
from flask_jwt_extended import get_jwt_identity, jwt_required, create_access_token, decode_token
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError

from app import app, db, BACKEND_URL
from app.models import User, UserRole
from app.utils import role_required, send_email


EMAIL_REGEX = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'


@app.route('/')
def homepage():
    return send_from_directory("../static", "doc.html")

@app.route("/api/getUserDetails", methods=["GET"])
@jwt_required()
def getUserDetails():
    identity = get_jwt_identity()
    user_id = identity["user_id"]
    user = db.session.get(User, user_id)
    return jsonify({
        "username": user.username,
        "email": user.email,
        "role": user.role.role_name
        }), 200


@app.route("/api/auth/login", methods=["POST"])
def login():
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    username = request.json.get("username", None)
    password = request.json.get("password", None)

    if not username or not password:
        return jsonify({"msg": "Missing username or password"}), 400

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({"msg": "Bad username or password"}), 401

    identity = {"user_id": user.user_id, "role": user.role.role_name}

    token = create_access_token(identity=identity)
    return jsonify(token=token, role=user.role.role_name), 200


@app.route("/api/auth/roles")
@role_required("edp")
def handle_roles():
    roles = db.session.scalars(db.select(UserRole)).all()
    return jsonify([role.asdict() for role in roles]), 200


@app.route("/api/auth/users", methods=["GET", "POST"])
@role_required("edp")
def handle_users():
    if request.method == "GET":
        users = db.session.scalars(db.select(User)).all()
        return jsonify([user.asdict() for user in users]), 200

    elif request.method == "POST":
        if not request.is_json:
            return jsonify({"msg": "Missing JSON in request"}), 400

        username = request.json.get("username", None)
        if not username:
            return jsonify({"msg": "Missing username"}), 400

        user = db.session.query(User).filter_by(username=username).first()
        if user:
            return jsonify({"msg": "Username already exists!"}), 409

        password = request.json.get("password", None)
        if not password:
            return jsonify({"msg": "Missing password"}), 400

        email = request.json.get("email", None)
        if not email:
            return jsonify({"msg": "Missing email"}), 400

        if not re.match(EMAIL_REGEX, email):
            return jsonify({"error": "Invalid email format"}), 400

        role_id = request.json.get("role_id", None)
        if not role_id:
            return jsonify({"msg": "Missing role id"}), 400

        role = db.session.query(UserRole).filter_by(role_id=role_id).first()
        if role is None:
            return jsonify({"msg": "Invalid role id"}), 400

        new_user = User(role_id, username, email, password)
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"user_id": new_user.user_id, "msg": "User created successfully"}), 200


@app.route("/api/auth/users/<int:user_id>", methods=["GET", "PATCH", "DELETE"])
@role_required("edp")
def handle_user(user_id):
    user = User.query.get_or_404(user_id)

    if request.method == "GET":
        return jsonify(user.asdict()), 200

    elif request.method == "PATCH":
        if not request.is_json:
            return jsonify({"msg": "Missing JSON in request"}), 400

        username = request.json.get("username", None)
        password = request.json.get("password", None)
        email = request.json.get("email", None)

        if username and user.username != username:
            otherUser = db.session.query(User).filter_by(username=username).first()
            if otherUser:
                return jsonify({"msg": "Username already exists!"}), 409
            user.username = username

        if email:
            if not re.match(EMAIL_REGEX, email):
                return jsonify({"error": "Invalid email format"}), 400
            user.email = email

        if password:
            user.password_hash = generate_password_hash(password)

        db.session.commit()
        return jsonify({"msg": "User updated successfully"}), 200

    elif request.method == "DELETE":
        try:
            db.session.delete(user)
            db.session.commit()
            return jsonify({"msg": "User deleted successfully"}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "Could not delete item", "details": str(e)}), 500


@app.route("/api/auth/change-password", methods=["POST"])
@jwt_required()
def handle_change_password():
    identity = get_jwt_identity()
    user_id = identity["user_id"]
    user = db.session.get(User, user_id)

    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    old_password = request.json.get("old_password", None)
    new_password = request.json.get("new_password", None)

    if old_password is None:
        return jsonify({"msg": "Missing old_password"}), 400

    if new_password is None:
        return jsonify({"msg": "Missing new_password"}), 400

    if not user.check_password(old_password):
        return jsonify({"msg": "Wrong old_password"}), 401

    user.password_hash = generate_password_hash(new_password)
    db.session.commit()

    return jsonify({"msg": "Password updated successfully"}), 200


@app.route("/api/auth/forget-password", methods=["POST"])
def handle_forget_password():
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    username = request.json.get("username", None)

    if username is None:
        return jsonify({"msg": "Missing username"}), 400

    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({"msg": "Username does not exist"}), 401

    token = create_access_token(identity=user.user_id)
    reset_link = f"{BACKEND_URL}/reset-password?token={token}"

    text_content = f"Username: {user.username}\nPassword Reset Link: {reset_link}"
    html_content = f"""
    <html>
        <body>
            <p>Please click the button below to reset the password for {user.username}</p>
            <p>
                <a href="{reset_link}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    RESET PASSWORD
                </a>
            </p>
            <br>
            <p>If the button doesn't work, use this link: <a href="{reset_link}">{reset_link}</a></p>
        </body>
    </html>
    """

    try:
        send_email("Password Reset", user.email, text_content, html_content)
        return jsonify({"msg": "Password reset link sent to user's email"}), 200
    except Exception as e:
        print(str(e))
        return jsonify({"msg": "Email failed to send"}), 424


@app.route("/reset-password", methods=["GET"])
def handle_reset_password():
    token = request.args.get("token")
    try:
        decoded_token = decode_token(token)
        user_id = decoded_token["sub"]
    except ExpiredSignatureError:
        return jsonify({"msg": "Token is expired"}), 401
    except InvalidTokenError:
        return jsonify({"msg": "Invalid Token"}), 401
    except KeyError:
        return jsonify({"msg": "Invalid contains no identity"}), 401

    user = User.query.get_or_404(user_id)

    alphabet = string.ascii_letters + string.digits
    new_password = ''.join(secrets.choice(alphabet) for i in range(8))

    user.password_hash = generate_password_hash(new_password)
    db.session.commit()

    return render_template("reset.html", password=new_password), 200
