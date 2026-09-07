from os import getenv

from werkzeug.security import check_password_hash
from flask_jwt_extended import get_jwt_identity, jwt_required, create_access_token
from flask import jsonify, request
from sqlalchemy import text

from app import app, db
from app.models import User, UserRole

def reset_database():
    with app.app_context():
        print("Testing database connection...")
        try:
            db.session.execute(text("SELECT 1"))
            print("Database connection successful!")
        except Exception as e:
            print(f"Database connection failed: {e}")
            return False

        print("Dropping all existing tables...")
        db.drop_all()
        print("Creating new table schemas...")
        db.create_all()
        print("Adding default rows...")
        role_names = ["Admin", "Student", "Teacher", "EDP", "Accounting", "Registrar"]
        roles = [UserRole(role_name=x) for x in role_names]
        db.session.add_all(roles)
        users = [[1, "AdminUser", "admin@school.com", "adminPassword"],
                 [2, "StudentUser", "student@school.com", "studentPassword"],
                 [3, "TeacherUser", "teacher@school.com", "teacherPassword"],
                 [4, "EDPUser", "edp@school.com", "edpPassword"],
                 [5, "AccountingUser", "accounting@school.com", "accountingPassword"],
                 [6, "RegistrarUser", "registrar@school.com", "registrarPassword"]]
        for u in users:
            db.session.add(User(u[0], u[1], u[2], u[3]))
        db.session.commit()
        print("Database ready!")
        return True


@app.route("/dev/resetdb", methods=["POST"])
def resetDB():
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    password = request.json.get("password", None)
    if not password:
        return jsonify({"msg": "Missing password"}), 400

    if not check_password_hash(getenv("DEV_SECRET"), password):
        return jsonify({"msg": "Wrong password"}), 401

    if reset_database():
        return jsonify({"msg": "Database reset successful!"}), 200
    else:
        return jsonify({"msg": "Failed to reset database..."}), 200
