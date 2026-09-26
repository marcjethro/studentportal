import string
import secrets

from werkzeug.security import generate_password_hash
from flask import jsonify, request, send_from_directory, render_template
from flask_jwt_extended import get_jwt_identity, jwt_required, decode_token
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from flask import Blueprint

from app import db
from app.models import User


main_bp = Blueprint("main", __name__)


@main_bp.route('/')
def homepage():
    return send_from_directory("../static", "doc.html")

@main_bp.route("/api/getUserDetails", methods=["GET"])
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


@main_bp.route("/reset-password", methods=["GET"])
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
