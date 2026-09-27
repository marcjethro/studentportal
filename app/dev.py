from os import getenv

from werkzeug.security import check_password_hash
from flask_jwt_extended import get_jwt_identity, jwt_required, create_access_token
from flask import jsonify, request
from sqlalchemy import text

from app import app, db
from app.models import User, UserRole, EnrollmentType, DocumentRequirement, Course

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
        role_names = ["student", "teacher", "edp", "accounting", "registrar", "admin"]
        roles = [UserRole(role_name=x) for x in role_names]
        db.session.add_all(roles)
        users = [[1, "studentUser", "flamingo49916@mailshan.com", "studentPassword"],
                 [2, "teacherUser", "teacher@school.com", "teacherPassword"],
                 [3, "edpUser", "edp@school.com", "edpPassword"],
                 [4, "accountingUser", "accounting@school.com", "accountingPassword"],
                 [5, "registrarUser", "registrar@school.com", "registrarPassword"],
                 [6, "adminUser", "admin@school.com", "adminPassword"]]
        for u in users:
            db.session.add(User(u[0], u[1], u[2], u[3]))

        enrollment_type_names = ["Old/Returnee Student", "New Student", "Transferee Student"]
        enrollment_types = [EnrollmentType(enrollment_type_name=name) for name in enrollment_type_names]
        db.session.add_all(enrollment_types)

        document_requirement_names = ["Study Load", "Complete Clearance Form"]
        document_requirements = [DocumentRequirement(enrollment_type_id=1, requirement_name=name) for name in document_requirement_names]
        db.session.add_all(document_requirements)

        document_requirement_names = ["Senior High School Grades", "Scholarship Documents", "Good Moral", "Diploma", "Form 137"]
        document_requirements = [DocumentRequirement(enrollment_type_id=2, requirement_name=name) for name in document_requirement_names]
        db.session.add_all(document_requirements)

        document_requirement_names = ["Transcript of Records", "Scholarship Documents", "Good Moral", "Diploma", "Honorable Dismissal"]
        document_requirements = [DocumentRequirement(enrollment_type_id=3, requirement_name=name) for name in document_requirement_names]
        db.session.add_all(document_requirements)

        course_names = ["Bachelor of Elementary Education", "Bachelor of Secondary Education", "BS in Information Technology", "BS in Tourism Management", "BS in Criminology"]
        courses = [Course(course_name=name) for name in course_names]
        db.session.add_all(courses)

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
