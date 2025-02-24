from flask import Flask, jsonify
from nba_api.live.nba.endpoints import scoreboard
from pymongo import MongoClient
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import os
import logging
import threading
import time
import pytz
import csv

# Flask App
app = Flask(__name__)

# Set timezone to Pacific Standard Time (PST)
PST = pytz.timezone("America/Los_Angeles")

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

# CSV File Path
CSV_FILE = "nba_game_updates.csv"

# Ensure CSV file has headers
if not os.path.exists(CSV_FILE):
    with open(CSV_FILE, mode="w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["Timestamp (PST)", "Game ID", "Date (PST)", "Home Team", "Home Score", "Away Team", "Away Score", "Status (PST)"])

# Official NBA Team Codes
NBA_TEAMS = {
    "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW", "HOU", "IND",
    "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK", "OKC", "ORL", "PHI", "PHX",
    "POR", "SAC", "SAS", "TOR", "UTA", "WAS"
}

# Get current PST date
def get_today_pst():
    return datetime.now(timezone.utc).astimezone(PST).date()

# Convert UTC time to PST format
def convert_to_pst(utc_time):
    if not utc_time:
        return "Unknown"
    utc_dt = datetime.strptime(utc_time, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    pst_dt = utc_dt.astimezone(PST)
    return pst_dt.strftime("%Y-%m-%d %I:%M %p PST")

# Convert game status to PST format
def convert_status_to_pst(status):
    if "ET" in status:
        return status.replace("ET", "PST")
    return status

# 🔄 **Save Game Updates to CSV**
def log_to_csv(game_data):
    with open(CSV_FILE, mode="a", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow([
            datetime.now(timezone.utc).astimezone(PST).strftime("%Y-%m-%d %H:%M:%S"),  # Timestamp in PST
            game_data["gameId"],
            game_data["formatted_date"],  # Date in PST
            game_data["homeTeam"],
            game_data["homeScore"],
            game_data["awayTeam"],
            game_data["awayScore"],
            game_data["status"]  # Status in PST
        ])

# 🏀 **Fetch Live NBA Games and Store in MongoDB**
def fetch_live_games():
    try:
        logging.info("📡 Fetching live games from NBA API...")
        scoreboard_data = scoreboard.ScoreBoard().get_dict()
        games = scoreboard_data.get("scoreboard", {}).get("games", [])

        if not games:
            logging.warning("⚠️ No live games returned from API.")
            return

        today_pst = get_today_pst()
        updated_count = 0

        # Clear old live games (Keep only today's games)
        live_games_collection.delete_many({"date": {"$lt": datetime.combine(today_pst, datetime.min.time(), PST)}})

        for game in games:
            game_id = game.get("gameId", "N/A")
            game_date_str = game.get("gameTimeUTC", "N/A")
            game_date = datetime.strptime(game_date_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc) if game_date_str != "N/A" else None

            home_team = game.get("homeTeam", {}).get("teamTricode", "Unknown")
            away_team = game.get("awayTeam", {}).get("teamTricode", "Unknown")

            if home_team in NBA_TEAMS and away_team in NBA_TEAMS and game_date.astimezone(PST).date() == today_pst:
                game_data = {
                    "gameId": game_id,
                    "date": game_date.astimezone(PST),
                    "formatted_date": convert_to_pst(game_date_str),
                    "homeTeam": home_team,
                    "homeScore": game.get("homeTeam", {}).get("score", 0),
                    "awayTeam": away_team,
                    "awayScore": game.get("awayTeam", {}).get("score", 0),
                    "status": convert_status_to_pst(game.get("gameStatusText", "Unknown")),
                }

                live_games_collection.update_one(
                    {"gameId": game_id},
                    {"$set": game_data},
                    upsert=True
                )
                updated_count += 1

                # Log the update to CSV
                log_to_csv(game_data)

        logging.info(f"🔄 Updated {updated_count} live games.")

    except Exception as e:
        logging.error(f"❌ Error fetching NBA live data: {e}")

# 🔄 **Move Past Games at Midnight PST**
def move_past_games():
    while True:
        now_pst = datetime.now(timezone.utc).astimezone(PST)
        midnight_pst = datetime.combine(now_pst.date() + timedelta(days=1), datetime.min.time(), PST)

        # Wait until midnight PST
        sleep_time = (midnight_pst - now_pst).total_seconds()
        logging.info(f"🕛 Waiting {sleep_time} seconds until midnight PST to move games.")
        time.sleep(sleep_time)

        # Move all today's live games to past games
        today_pst = get_today_pst()
        past_games = list(live_games_collection.find({"date": {"$lt": datetime.combine(today_pst, datetime.max.time(), PST)}}))

        if past_games:
            for game in past_games:
                game.pop("_id", None)  # Remove MongoDB Object ID before moving
                past_games_collection.update_one(
                    {"gameId": game["gameId"]},
                    {"$set": game},
                    upsert=True
                )

            live_games_collection.delete_many({"date": {"$lt": datetime.combine(today_pst, datetime.max.time(), PST)}})
            logging.info(f"✅ Moved {len(past_games)} games to PastGames.")

# 📅 **Past Games API**
@app.route("/past-games", methods=["GET"])
def get_past_games():
    try:
        past_games = list(past_games_collection.find({}, {"_id": 0}))
        return jsonify({"past_games": past_games})

    except Exception as e:
        logging.error(f"❌ Error retrieving past game data: {str(e)}")
        return jsonify({"error": f"Error retrieving data: {str(e)}"}), 500

# 📺 **Live Games API Endpoint**
@app.route("/live-games", methods=["GET"])
def get_live_games():
    try:
        today_pst = get_today_pst()
        live_games = list(live_games_collection.find(
            {"date": {"$gte": datetime.combine(today_pst, datetime.min.time(), PST)}},
            {"_id": 0}
        ))

        return jsonify({"live_games": live_games})

    except Exception as e:
        logging.error(f"❌ Error retrieving live game data: {str(e)}")
        return jsonify({"error": f"Error retrieving data: {str(e)}"}), 500

if __name__ == "__main__":
    fetch_live_games()
    threading.Thread(target=move_past_games, daemon=True).start()
    app.run(port=5000, debug=True)