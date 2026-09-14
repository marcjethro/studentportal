from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt

def role_required(allowed_roles):
    """
    Decorator to restrict access to specific user roles.
    Accepts a single role string or a list of role strings.
    """
    if isinstance(allowed_roles, str):
        allowed_roles = [allowed_roles]

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # 1. Ensure a valid JWT is present in the request
            verify_jwt_in_request()
            
            # 2. Extract custom claims from the JWT
            claims = get_jwt()
            user_role = claims.get("role")

            # 3. Check if the user's role is permitted
            if user_role not in allowed_roles:
                return jsonify({"msg": "Forbidden: Insufficient permissions"}), 403
                
            return fn(*args, **kwargs)
        return wrapper
    return decorator
