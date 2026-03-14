"""
Community Routes
================
Handles CRUD for community posts and comments.
Uses Firestore (or MockFirestore in demo mode).
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
import uuid

from firebase_config import db

community_bp = Blueprint("community", __name__)


# ─── Demo seed data ───────────────────────────────────────────────────────────
_SEEDED = False

DEMO_POSTS = [
    {
        "id": "post-001",
        "author": "Rajesh Kumar",
        "avatar": "",
        "title": "Best drip irrigation setup for tomato fields?",
        "content": "I have a 2-acre tomato farm in Maharashtra. Currently using flood irrigation but want to switch to drip. What spacing and flow rate works best? My soil is black cotton soil with moderate drainage.",
        "tags": ["irrigation", "tomatoes", "drip-irrigation"],
        "upvotes": 24,
        "upvotedBy": ["user-002", "user-003", "user-004"],
        "commentCount": 3,
        "isGeminiAnswer": False,
        "createdAt": "2026-03-13T08:30:00Z",
    },
    {
        "id": "post-002",
        "author": "Priya Sharma",
        "avatar": "",
        "title": "Neem oil spray schedule for pest control",
        "content": "My brinjal crop is getting attacked by fruit borers. I've heard neem oil works well. What concentration should I use and how often should I spray? Also, is it safe to use alongside chemical fertilisers?",
        "tags": ["pest-control", "organic", "brinjal"],
        "upvotes": 18,
        "upvotedBy": ["user-001", "user-003"],
        "commentCount": 2,
        "isGeminiAnswer": False,
        "createdAt": "2026-03-12T14:15:00Z",
    },
    {
        "id": "post-003",
        "author": "Gemini AI",
        "avatar": "gemini",
        "title": "💡 How to check soil moisture without a sensor",
        "content": "**Simple hand-feel method:**\n\n1. **Take a handful of soil** from 6 inches deep in your field\n2. **Squeeze it tightly** in your fist\n3. **Open your hand** and observe:\n   - If the soil **crumbles apart** → Too dry, irrigate soon\n   - If it **holds shape but breaks when poked** → Perfect moisture level\n   - If **water drips out** → Over-watered, stop irrigation\n\n**Pro tip:** Check at multiple spots across your field, as moisture can vary.\n\n*This method works best for clay and loam soils. Sandy soils drain faster and may need more frequent checks.*",
        "tags": ["soil-health", "tips", "gemini-answer"],
        "upvotes": 42,
        "upvotedBy": ["user-001", "user-002", "user-003", "user-004", "user-005"],
        "commentCount": 5,
        "isGeminiAnswer": True,
        "createdAt": "2026-03-11T10:00:00Z",
    },
    {
        "id": "post-004",
        "author": "Anil Patel",
        "avatar": "",
        "title": "DAP vs NPK fertilizer for wheat crop",
        "content": "I'm confused between using DAP and NPK complex for my wheat crop. The wheat is currently at tillering stage. Local dealers recommend both but at different prices. Which is more cost-effective and gives better yield? My soil test shows nitrogen deficiency.",
        "tags": ["fertilizers", "wheat", "soil-health"],
        "upvotes": 15,
        "upvotedBy": ["user-002"],
        "commentCount": 4,
        "isGeminiAnswer": False,
        "createdAt": "2026-03-10T16:45:00Z",
    },
    {
        "id": "post-005",
        "author": "Meera Devi",
        "avatar": "",
        "title": "Rainwater harvesting for small farms - my experience",
        "content": "I built a simple rainwater harvesting system on my 1-acre farm last monsoon. Used a 10,000-litre tank connected to my cowshed roof. Collected enough water to irrigate my vegetable garden for 2 months after monsoon ended. Total cost was around ₹15,000. Happy to share the design details!",
        "tags": ["irrigation", "rainwater", "sustainable"],
        "upvotes": 56,
        "upvotedBy": ["user-001", "user-002", "user-003", "user-004", "user-005", "user-006"],
        "commentCount": 8,
        "isGeminiAnswer": False,
        "createdAt": "2026-03-09T09:20:00Z",
    },
]

DEMO_COMMENTS = {
    "post-001": [
        {
            "id": "cmt-001",
            "author": "Suresh Yadav",
            "text": "I use 4L/hr drippers spaced 30cm apart for my tomatoes. Works great on red soil. For black cotton soil, you might want to go with 2L/hr to avoid waterlogging.",
            "createdAt": "2026-03-13T10:15:00Z",
        },
        {
            "id": "cmt-002",
            "author": "Priya Sharma",
            "text": "Also consider using mulch film along with drip irrigation. It reduces water evaporation by 30-40% and keeps weeds away.",
            "createdAt": "2026-03-13T11:30:00Z",
        },
        {
            "id": "cmt-003",
            "author": "Gemini AI",
            "text": "For black cotton soil with tomatoes, I recommend **2 L/hr inline drippers** spaced at **40 cm** with laterals **1.2 m apart**. Run irrigation for **45-60 minutes** every alternate day. This gives optimal moisture without waterlogging. 🌱",
            "createdAt": "2026-03-13T12:00:00Z",
            "isGeminiAnswer": True,
        },
    ],
    "post-002": [
        {
            "id": "cmt-004",
            "author": "Rajesh Kumar",
            "text": "Use 5ml neem oil per litre of water. Spray early morning or evening. Repeat every 7-10 days. It's safe with most fertilisers but avoid mixing directly.",
            "createdAt": "2026-03-12T15:30:00Z",
        },
        {
            "id": "cmt-005",
            "author": "Anil Patel",
            "text": "I had the same problem last year. Pheromone traps also work well alongside neem oil. You can get them from any KVK centre.",
            "createdAt": "2026-03-12T16:45:00Z",
        },
    ],
}


def _seed_community_data():
    """Seed mock community data into Firestore."""
    global _SEEDED
    if _SEEDED:
        return
    _SEEDED = True

    try:
        for post in DEMO_POSTS:
            db.collection("community_posts").document(post["id"]).set(post)

        for post_id, comments in DEMO_COMMENTS.items():
            for comment in comments:
                db.collection("community_comments").document(comment["id"]).set(
                    {**comment, "postId": post_id}
                )
    except Exception as e:
        print(f"⚠️  Community seed failed: {e}")


# ─── Routes ───────────────────────────────────────────────────────────────────

@community_bp.route("/community/posts", methods=["GET"])
def get_posts():
    """Get all community posts, newest first."""
    _seed_community_data()
    try:
        docs = (
            db.collection("community_posts")
            .order_by("createdAt", direction="DESCENDING")
            .stream()
        )
        posts = [d.to_dict() for d in docs]
        return jsonify({"posts": posts})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@community_bp.route("/community/posts", methods=["POST"])
def create_post():
    """Create a new community post."""
    _seed_community_data()
    data = request.json or {}
    post_id = f"post-{uuid.uuid4().hex[:8]}"
    post = {
        "id": post_id,
        "author": data.get("author", "Anonymous Farmer"),
        "avatar": data.get("avatar", ""),
        "title": data.get("title", ""),
        "content": data.get("content", ""),
        "tags": data.get("tags", []),
        "upvotes": 0,
        "upvotedBy": [],
        "commentCount": 0,
        "isGeminiAnswer": data.get("isGeminiAnswer", False),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    try:
        db.collection("community_posts").document(post_id).set(post)
        return jsonify(post), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@community_bp.route("/community/posts/<post_id>/upvote", methods=["POST"])
def upvote_post(post_id):
    """Toggle upvote on a post."""
    _seed_community_data()
    data = request.json or {}
    user_id = data.get("userId", "anonymous")

    try:
        doc = db.collection("community_posts").document(post_id).get()
        if not doc.exists:
            return jsonify({"error": "Post not found"}), 404

        post = doc.to_dict()
        upvoted_by = post.get("upvotedBy", [])

        if user_id in upvoted_by:
            upvoted_by.remove(user_id)
        else:
            upvoted_by.append(user_id)

        db.collection("community_posts").document(post_id).update({
            "upvotes": len(upvoted_by),
            "upvotedBy": upvoted_by,
        })
        return jsonify({"upvotes": len(upvoted_by), "upvotedBy": upvoted_by})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@community_bp.route("/community/posts/<post_id>/comments", methods=["GET"])
def get_comments(post_id):
    """Get comments for a specific post."""
    _seed_community_data()
    try:
        docs = (
            db.collection("community_comments")
            .where("postId", "==", post_id)
            .order_by("createdAt")
            .stream()
        )
        comments = [d.to_dict() for d in docs]
        return jsonify({"comments": comments})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@community_bp.route("/community/posts/<post_id>/comments", methods=["POST"])
def add_comment(post_id):
    """Add a comment to a post."""
    _seed_community_data()
    data = request.json or {}
    comment_id = f"cmt-{uuid.uuid4().hex[:8]}"
    comment = {
        "id": comment_id,
        "postId": post_id,
        "author": data.get("author", "Anonymous Farmer"),
        "text": data.get("text", ""),
        "isGeminiAnswer": data.get("isGeminiAnswer", False),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    try:
        db.collection("community_comments").document(comment_id).set(comment)

        # Update comment count on the post
        doc = db.collection("community_posts").document(post_id).get()
        if doc.exists:
            post = doc.to_dict()
            db.collection("community_posts").document(post_id).update({
                "commentCount": post.get("commentCount", 0) + 1,
            })

        return jsonify(comment), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
