from flask import Flask, jsonify
from nba_api.live.nba.endpoints import scoreboard
from pymongo import MongoClient
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os
import logging
import threading
import time
import pytz

# Flask App
app = Flask(__name__)

western = pytz.timezone("America/Los_Angeles")

# Logging Setup
logging.basicConfig(level=logging.INFO)

# MongoDB Setup
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise ValueError("❌ MONGO_URI is not set. Check your .env file.")

client = MongoClient(MONGO_URI)
db = client["NBA_DB"]
live_games_collection = db["LiveGames"]
past_games_collection = db["PastGames"]

# Official NBA Team Codes
NBA_TEAMS = {
    "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW", "HOU", "IND",
    "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK", "OKC", "ORL", "PHI", "PHX",
    "POR", "SAC", "SAS", "TOR", "UTA", "WAS"
}

# Get current date/time values
TODAY = datetime.utcnow().strftime("%Y-%m-%d")
LAST_WEEK = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")

def format_game_time(utc_time):
    if not utc_time:
        return "Unknown"
    utc_dt = datetime.strptime(utc_time, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=pytz.utc)
    local_dt = utc_dt.astimezone(western)
    return local_dt.strftime("%Y-%m-%d %I:%M %p ET")

# 🏀 **Fetch Live NBA Games and Store in MongoDB**
def fetch_live_games():
    try:
        logging.info("📡 Fetching live games from NBA API...")
        scoreboard_data = scoreboard.ScoreBoard().get_dict()
        games = scoreboard_data.get("scoreboard", {}).get("games", [])

        if not games:
            logging.warning("⚠️ No live games returned from API.")
            return

        updated_count = 0
        for game in games:
            game_id = game.get("gameId", "N/A")
            game_date_str = game.get("gameTimeUTC", "N/A")
            game_date = datetime.strptime(game_date_str, "%Y-%m-%dT%H:%M:%SZ") if game_date_str != "N/A" else None

            home_team = game.get("homeTeam", {}).get("teamTricode", "Unknown")
            away_team = game.get("awayTeam", {}).get("teamTricode", "Unknown")

            # Filter only NBA games
            if home_team in NBA_TEAMS and away_team in NBA_TEAMS:
                game_data = {
                    "gameId": game_id,
                    "date": game_date,  # 🔹 Store as datetime object for proper filtering
                    "formatted_date": format_game_time(game_date_str),  # Keep formatted version for display
                    "homeTeam": home_team,
                    "homeScore": game.get("homeTeam", {}).get("score", 0),
                    "awayTeam": away_team,
                    "awayScore": game.get("awayTeam", {}).get("score", 0),
                    "status": game.get("gameStatusText", "Unknown")
                }

                # If game is finalized, move to past games
                if game_data["status"] in ["Final", "Final/OT"]:
                    past_games_collection.update_one(
                        {"gameId": game_id},
                        {"$set": game_data},
                        upsert=True
                    )
                    live_games_collection.delete_one({"gameId": game_id})
                    logging.info(f"✅ Moved finished game {game_id} to past games.")
                else:
                    # Store or update in LiveGames collection
                    live_games_collection.update_one(
                        {"gameId": game_id},
                        {"$set": game_data},
                        upsert=True
                    )
                    updated_count += 1

        logging.info(f"🔄 Updated {updated_count} live games.")

    except Exception as e:
        logging.error(f"❌ Error fetching NBA live data: {e}")

# 🔄 **Auto-Refresh Live Games Every 30 Seconds**
def update_live_games_periodically():
    """Fetch live games every 30 seconds in the background."""
    while True:
        fetch_live_games()
        time.sleep(30)  # Wait 30 seconds before updating again

# 📺 **Live Games API Endpoint**
@app.route("/live-games", methods=["GET"])
def get_live_games():
    try:
        live_games = list(live_games_collection.find({}, {"_id": 0}))

        if not live_games:
            logging.warning("⚠️ No live games found in MongoDB.")
        else:
            logging.info(f"📊 Returning {len(live_games)} live games.")

        return jsonify({"live_games": live_games})

    except Exception as e:
        logging.error(f"❌ Error retrieving live game data: {str(e)}")
        return jsonify({"error": f"Error retrieving data: {str(e)}"}), 500

# 📅 **Past Games API**
@app.route("/past-games", methods=["GET"])
def get_past_games():
    try:
        one_week_ago = datetime.utcnow() - timedelta(days=7)  # Get last week's games

        past_games = list(past_games_collection.find(
            {"date": {"$gte": one_week_ago}},  # 🔹 Now filtering correctly by date
            {"_id": 0}
        ))

        return jsonify({"past_games": past_games})

    except Exception as e:
        logging.error(f"❌ Error retrieving past game data: {str(e)}")
        return jsonify({"error": f"Error retrieving data: {str(e)}"}), 500

# 📅 **Upcoming Games API**
@app.route("/upcoming-games", methods=["GET"])
def get_upcoming_games():
    try:
        today = datetime.utcnow().date()  # Get today's date
        scoreboard_data = scoreboard.ScoreBoard().get_dict()
        games = scoreboard_data.get("scoreboard", {}).get("games", [])

        upcoming_games = []
        for game in games:
            game_date_str = game.get("gameTimeUTC", "N/A")
            game_date = datetime.strptime(game_date_str, "%Y-%m-%dT%H:%M:%SZ") if game_date_str != "N/A" else None

            home_team = game.get("homeTeam", {}).get("teamTricode", "Unknown")
            away_team = game.get("awayTeam", {}).get("teamTricode", "Unknown")

            if home_team in NBA_TEAMS and away_team in NBA_TEAMS:
                if game_date and game_date.date() >= today:  # 🔹 Ensure only upcoming games
                    upcoming_games.append({
                        "gameId": game.get("gameId", "N/A"),
                        "date": format_game_time(game_date_str),
                        "homeTeam": home_team,
                        "awayTeam": away_team,
                        "status": "Scheduled"
                    })

        return jsonify({"upcoming_games": upcoming_games})

    except Exception as e:
        logging.error(f"❌ Error retrieving upcoming games: {str(e)}")
        return jsonify({"error": f"Error retrieving data: {str(e)}"}), 500

# 🏀 **Startup Setup**
if __name__ == "__main__":
    print("\n✅ Fetching initial live NBA games...")
    fetch_live_games()

    # Start background thread to keep live games updated
    threading.Thread(target=update_live_games_periodically, daemon=True).start()

    print("\n✅ Flask server is now running at http://127.0.0.1:5000")
    app.run(port=5000, debug=True)
