from flask import Flask, jsonify, request
from flask_cors import CORS
from nba_api.live.nba.endpoints import scoreboard, playbyplay, boxscore
from nba_api.stats.endpoints import leaguegamefinder, alltimeleadersgrids, leagueleaders, leaguestandingsv3
from pymongo import MongoClient
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import os, logging, threading, time, pytz, csv, re, requests
import numpy as np
import pandas as pd

# Flask App
app = Flask(__name__)

# Enable CORS
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}}) 

# Set timezone to Pacific Standard Time (PST)
PST = pytz.timezone("America/Los_Angeles")

# Logging Setup
logging.basicConfig(level=logging.INFO)

# MongoDB Setup
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise ValueError("MONGO_URI is not set. Check your .env file.")

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

# **Save Game Updates to CSV**
def log_to_csv(game_data):
    """
    Logs game updates to a CSV file.
    Ensures consistent data formatting and prevents missing fields.
    """
    try:
        with open(CSV_FILE, mode="a", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow([
                datetime.now(timezone.utc).astimezone(PST).strftime("%Y-%m-%d %H:%M:%S"),  # Timestamp in PST
                game_data.get("gameId", "N/A"),
                game_data.get("gameTimePST", "Unknown"),  # Game start time in PST
                game_data["homeTeam"].get("teamTricode", "Unknown"),
                game_data["homeTeam"].get("score", 0),
                game_data["awayTeam"].get("teamTricode", "Unknown"),
                game_data["awayTeam"].get("score", 0),
                game_data.get("status", "Unknown"),  # Game status
                game_data.get("period", 0),  # Current period
                game_data.get("gameClock", "00:00"),  # Game clock
                game_data.get("arena", "Unknown"),  # Arena name
                game_data["location"].get("city", "Unknown"),  # City of game
                game_data["location"].get("state", "Unknown"),  # State of game
                game_data.get("attendance", 0),  # Attendance number
                game_data.get("playoffs", "N/A")  # Playoff series text
            ])
        
        logging.info(f"Logged game {game_data.get('gameId', 'N/A')} to CSV.")
    
    except Exception as e:
        logging.error(f"Error logging to CSV: {str(e)}")

# **Fetch Live NBA Games and Store in MongoDB**
def fetch_live_games():
    try:
        logging.info("Fetching live games from NBA API...")
        
        # Retrieve scoreboard data as dictionary
        scoreboard_data = scoreboard.ScoreBoard().get_dict()

        # Extract list of games
        games = scoreboard_data.get("scoreboard", {}).get("games", [])

        if not games:
            logging.warning("No live games returned from API.")
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
                    "gameTimePST": convert_to_pst(game_date_str),
                    "period": game.get("period", 0),
                    "gameClock": game.get("gameClock", "00:00"),
                    "status": convert_status_to_pst(game.get("gameStatusText", "Unknown")),
                    "homeTeam": {
                        "teamId": game.get("homeTeam", {}).get("teamId", "Unknown"),
                        "teamName": game.get("homeTeam", {}).get("teamName", "Unknown"),
                        "teamTricode": home_team,
                        "score": game.get("homeTeam", {}).get("score", 0),
                    },
                    "awayTeam": {
                        "teamId": game.get("awayTeam", {}).get("teamId", "Unknown"),
                        "teamName": game.get("awayTeam", {}).get("teamName", "Unknown"),
                        "teamTricode": away_team,
                        "score": game.get("awayTeam", {}).get("score", 0),
                    },
                    "arena": game.get("arena", {}).get("name", "Unknown"),
                    "location": {
                        "city": game.get("arena", {}).get("city", "Unknown"),
                        "state": game.get("arena", {}).get("stateAbbr", "Unknown"),
                    },
                    "attendance": game.get("attendance", 0),
                    "playoffs": game.get("playoffs", {}).get("seriesText", "N/A"),
                }

                # Update the live games collection
                live_games_collection.update_one(
                    {"gameId": game_id},
                    {"$set": game_data},
                    upsert=True
                )

                log_to_csv(game_data)
                updated_count += 1

        logging.info(f"Updated {updated_count} live games.")

    except Exception as e:
        logging.error(f"Error fetching NBA live data: {e}")

# **Move Past Games at Midnight PST**
def move_past_games():
    while True:
        now_pst = datetime.now(timezone.utc).astimezone(PST)
        midnight_pst = datetime.combine(now_pst.date() + timedelta(days=1), datetime.min.time(), PST)

        # Wait until midnight PST
        sleep_time = (midnight_pst - now_pst).total_seconds()
        logging.info(f"Waiting {sleep_time} seconds until midnight PST to move games.")
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
            logging.info(f"Moved {len(past_games)} games to PastGames.")

# **Past Games API**
@app.route("/past-games", methods=["GET"])
def get_past_games():
    try:
        # Get the target date from query parameters (default to yesterday)
        target_date = request.args.get("date", (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d"))

        logging.info(f"Fetching past games from the current season for {target_date}...")

        # Fetch all past games for the current season
        games_data = leaguegamefinder.LeagueGameFinder(season_nullable="2023-24", season_type_nullable="Regular Season").get_dict()
        games = games_data['resultSets'][0]['rowSet']

        if not games:
            logging.warning(f"No past games found for {target_date}.")
            return jsonify({"past_games": []})  # Return an empty list instead of an error

        past_games_data = []

        for game in games:
            game_date_str = game[4]  # Date format is YYYY-MM-DD
            if game_date_str != target_date:
                continue  # Skip games not from the requested date

            past_game = {
                "gameId": game[2],
                "gameTimePST": convert_to_pst(game_date_str),
                "homeTeam": {
                    "teamTricode": game[6],  # Home team abbreviation
                    "score": game[22],  # Home team score
                },
                "awayTeam": {
                    "teamTricode": game[7],  # Away team abbreviation
                    "score": game[23],  # Away team score
                },
                "status": "Final",
                "arena": "Unknown",  # LeagueGameFinder does not provide arena data
                "location": {
                    "city": "Unknown",
                    "state": "Unknown",
                },
                "playoffs": "N/A",
            }

            past_games_data.append(past_game)

        logging.info(f"Sending {len(past_games_data)} past games to frontend.")
        return jsonify({"past_games": past_games_data})

    except Exception as e:
        logging.error(f"Error retrieving past game data: {str(e)}")
        return jsonify({"error": f"Error retrieving data: {str(e)}"}), 500

# Helper function to convert "PT00M57.10S" to "00:57"
def format_game_clock(game_clock):
    if not game_clock or not game_clock.startswith("PT"):
        return "00:00"  # Default if invalid format

    # Extract minutes and seconds using regex
    match = re.search(r"PT(\d+)M([\d.]+)S", game_clock)
    if match:
        minutes, seconds = match.groups()
        return f"{int(minutes):02}:{int(float(seconds)):02}"  # Convert to MM:SS format
    return "00:00"  # Default if format is unexpected

@app.route("/live-games", methods=["GET"])
def get_live_games():
    try:
        logging.info("Fetching live games from NBA API...")

        # Retrieve live game data from the NBA API
        scoreboard_data = scoreboard.ScoreBoard().get_dict()
        games = scoreboard_data.get("scoreboard", {}).get("games", [])

        if not games:
            logging.warning("No live games found.")
            return jsonify({"live_games": []})  # Return an empty list instead of an error

        live_games_data = []

        for game in games:
            game_id = game.get("gameId", "N/A")
            game_date_str = game.get("gameTimeUTC", "N/A")
            game_date = datetime.strptime(game_date_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc) if game_date_str != "N/A" else None

            home_team = game.get("homeTeam", {})
            away_team = game.get("awayTeam", {})

            live_game = {
                "gameId": game_id,
                "gameTimePST": convert_to_pst(game_date_str),
                "period": game.get("period", 0),
                "gameClock": format_game_clock(game.get("gameClock", "00:00")),  # Fix game clock
                "status": convert_status_to_pst(game.get("gameStatusText", "Unknown")),
                "homeTeam": {
                    "teamId": home_team.get("teamId", "Unknown"),
                    "teamName": home_team.get("teamName", "Unknown"),
                    "teamTricode": home_team.get("teamTricode", "Unknown"),
                    "score": home_team.get("score", 0),
                    "wins": home_team.get("wins", 0),  # Added wins
                    "losses": home_team.get("losses", 0),  # Added losses
                },
                "awayTeam": {
                    "teamId": away_team.get("teamId", "Unknown"),
                    "teamName": away_team.get("teamName", "Unknown"),
                    "teamTricode": away_team.get("teamTricode", "Unknown"),
                    "score": away_team.get("score", 0),
                    "wins": away_team.get("wins", 0),  # Added wins
                    "losses": away_team.get("losses", 0),  # Added losses
                },
                "arena": game.get("arena", {}).get("name", "Unknown"),
                "location": {
                    "city": game.get("arena", {}).get("city", "Unknown"),
                    "state": game.get("arena", {}).get("stateAbbr", "Unknown"),
                },
                "attendance": game.get("attendance", 0),
                "playoffs": game.get("playoffs", {}).get("seriesText", "N/A"),
            }

            live_games_data.append(live_game)

        logging.info(f"Sending {len(live_games_data)} live games to frontend.")
        return jsonify({"live_games": live_games_data})

    except Exception as e:
        logging.error(f"Error retrieving live game data: {str(e)}")
        return jsonify({"error": f"Error retrieving data: {str(e)}"}), 500

# **Live Game Boxscore API Endpoint**
@app.route("/game-boxscore/<game_id>", methods=["GET"])
def get_game_boxscore(game_id):
    try:
        # Fetch boxscore data for the game
        boxscore_data = boxscore.BoxScore(game_id).get_dict()
        logging.info(f"Boxscore data for game {game_id}: {boxscore_data}")

        game_data = boxscore_data.get("game", {})

        # Get statistics for teams
        home_team_data = game_data.get('homeTeam', {})
        away_team_data = game_data.get('awayTeam', {})

        home_team_stats = home_team_data.get('statistics', {})
        away_team_stats = away_team_data.get('statistics', {})

        if not home_team_stats or not away_team_stats:
            return jsonify({"error": "No boxscore data found for this game."}), 404

        # Function to extract quarter scores
        def get_period_scores(team):
            quarters = {"Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0, "OT": 0}
            for period in team.get("periods", []):
                num = period.get("period", 0)
                score = period.get("score", 0)
                if 1 <= num <= 4:
                    quarters[f"Q{num}"] = score
                else:
                    quarters["OT"] += score
            return quarters

        # Create summary stats and quarter scores
        home_summary = {
            "points": home_team_stats.get("points", 0),
            "fieldGoalsMade": home_team_stats.get("fieldGoalsMade", 0),
            "fieldGoalsAttempted": home_team_stats.get("fieldGoalsAttempted", 0),
            "threePointersMade": home_team_stats.get("threePointersMade", 0),
            "threePointersAttempted": home_team_stats.get("threePointersAttempted", 0),
            "freeThrowsMade": home_team_stats.get("freeThrowsMade", 0),
            "freeThrowsAttempted": home_team_stats.get("freeThrowsAttempted", 0),
            "rebounds": home_team_stats.get("reboundsTotal", 0),
            "assists": home_team_stats.get("assists", 0),
            "steals": home_team_stats.get("steals", 0),
            "blocks": home_team_stats.get("blocks", 0),
            "turnovers": home_team_stats.get("turnovers", 0),
            "quarters": get_period_scores(home_team_data)
        }

        away_summary = {
            "points": away_team_stats.get("points", 0),
            "fieldGoalsMade": away_team_stats.get("fieldGoalsMade", 0),
            "fieldGoalsAttempted": away_team_stats.get("fieldGoalsAttempted", 0),
            "threePointersMade": away_team_stats.get("threePointersMade", 0),
            "threePointersAttempted": away_team_stats.get("threePointersAttempted", 0),
            "freeThrowsMade": away_team_stats.get("freeThrowsMade", 0),
            "freeThrowsAttempted": away_team_stats.get("freeThrowsAttempted", 0),
            "rebounds": away_team_stats.get("reboundsTotal", 0),
            "assists": away_team_stats.get("assists", 0),
            "steals": away_team_stats.get("steals", 0),
            "blocks": away_team_stats.get("blocks", 0),
            "turnovers": away_team_stats.get("turnovers", 0),
            "quarters": get_period_scores(away_team_data)
        }

        # Extract player stats
        def extract_players(players):
            return [
                {
                    "name": p.get("name", "Unknown"),
                    "points": p.get("statistics", {}).get("points", 0),
                    "assists": p.get("statistics", {}).get("assists", 0),
                    "rebounds": p.get("statistics", {}).get("reboundsTotal", 0),
                    "fieldGoalsAttempted": p.get("statistics", {}).get("fieldGoalsAttempted", 0),
                    "fieldGoalsMade": p.get("statistics", {}).get("fieldGoalsMade", 0),
                    "fieldGoalsPercentage": p.get("statistics", {}).get("fieldGoalsPercentage", 0),
                    "threePointersAttempted": p.get("statistics", {}).get("threePointersAttempted", 0),
                    "threePointersMade": p.get("statistics", {}).get("threePointersMade", 0),
                    "threePointersPercentage": p.get("statistics", {}).get("threePointersPercentage", 0),
                    "freeThrowsAttempted": p.get("statistics", {}).get("freeThrowsAttempted", 0),
                    "freeThrowsMade": p.get("statistics", {}).get("freeThrowsMade", 0),
                    "freeThrowsPercentage": p.get("statistics", {}).get("freeThrowsPercentage", 0),
                    "steals": p.get("statistics", {}).get("steals", 0),
                    "blocks": p.get("statistics", {}).get("blocks", 0),
                    "turnovers": p.get("statistics", {}).get("turnovers", 0),
                    "starter": p.get("starter", 0),
                }
                for p in players
            ]

        game_boxscore = {
            "gameId": game_id,
            "homeTeam": {
                "teamName": home_team_data.get("teamName", "Unknown"),
                "score": home_team_stats.get("points", 0),
                "summary": home_summary,
                "players": extract_players(home_team_data.get("players", []))
            },
            "awayTeam": {
                "teamName": away_team_data.get("teamName", "Unknown"),
                "score": away_team_stats.get("points", 0),
                "summary": away_summary,
                "players": extract_players(away_team_data.get("players", []))
            }
        }

        return jsonify(game_boxscore)

    except Exception as e:
        logging.error(f"Error fetching game boxscore: {str(e)}")
        return jsonify({"error": f"Error retrieving game boxscore: {str(e)}"}), 500
    
@app.route("/all-time-leaders", methods=["GET"])
def get_all_time_leaders():
    try:
        data = alltimeleadersgrids.AllTimeLeadersGrids().get_dict()

        categories = data["resultSets"]
        all_leaders = {}

        for category in categories:
            category_name = category["name"]
            leaders = [
                {
                    "player": row[1],
                    "team": row[2],
                    "statValue": row[3]
                } for row in category["rowSet"][:10]  # Top 10
            ]
            all_leaders[category_name] = leaders

        return jsonify(all_leaders)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/all-time-playoff-leaders", methods=["GET"])
def get_all_time_playoff_leaders():
    try:
        data = alltimeleadersgrids.AllTimeLeadersGrids(season_type="Playoffs").get_dict()

        categories = data["resultSets"]
        all_leaders = {}

        for category in categories:
            category_name = category["name"]
            leaders = [
                {
                    "player": row[1],
                    "team": row[2],
                    "statValue": row[3]
                } for row in category["rowSet"][:10]  # Top 10
            ]
            all_leaders[category_name] = leaders

        return jsonify(all_leaders)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/current-season-leaders", methods=["GET"])
def get_current_season_leaders():
    try:
        season = request.args.get("season", "2024-25") 
        season_type = request.args.get("season_type", "Regular Season")

        data = leagueleaders.LeagueLeaders(
            season=season,
            season_type_all_star=season_type
        ).get_dict()

        leaders_data = data["resultSet"]["rowSet"]
        headers = data["resultSet"]["headers"]

        leaders = [
            dict(zip(headers, row))
            for row in leaders_data
        ]

        return jsonify(leaders)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/player-career-stats/<int:player_id>", methods=["GET"])
def get_player_career_stats(player_id):
    from nba_api.stats.endpoints import playercareerstats, commonplayerinfo

    try:
        data = playercareerstats.PlayerCareerStats(player_id=player_id).get_dict()
        career = data["resultSets"][0] 

        career_stats = [
            {
                "season": row[1],
                "team_id": row[3],
                "team_abbreviation": row[4],
                "games_played": row[6],
                "points": row[26],
                "assists": row[21],
                "rebounds": row[20],
                "steals": row[22],
                "blocks": row[23],
                "fg_pct": row[9],
                "three_pct": row[12],
                "ft_pct": row[15],
                "turnovers": row[24],
                "minutes": row[7]
            } for row in career["rowSet"]
        ]

        info = commonplayerinfo.CommonPlayerInfo(player_id=player_id).get_dict()
        full_name = info['resultSets'][0]['rowSet'][0][3] 

        return jsonify({
            "player_id": player_id,
            "name": full_name,
            "career_stats": career_stats
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route("/standings", methods=["GET"])
def get_standings():
    try:
        standings = leaguestandingsv3.LeagueStandingsV3(season="2024-25", season_type="Regular Season")
        data = standings.get_data_frames()[0]

        data_cleaned = data.replace({np.nan: None, pd.NaT: None})

        standings_list = data_cleaned.to_dict(orient="records")

        return jsonify(standings_list)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route("/team-info/<team_code>", methods=["GET"])
def get_team_info(team_code):
    from nba_api.stats.static import teams

    team_code_to_id = {
        "ATL": 1610612737, "BOS": 1610612738, "BKN": 1610612751, "CHA": 1610612766,
        "CHI": 1610612741, "CLE": 1610612739, "DAL": 1610612742, "DEN": 1610612743,
        "DET": 1610612765, "GSW": 1610612744, "HOU": 1610612745, "IND": 1610612754,
        "LAC": 1610612746, "LAL": 1610612747, "MEM": 1610612763, "MIA": 1610612748,
        "MIL": 1610612749, "MIN": 1610612750, "NOP": 1610612740, "NYK": 1610612752,
        "OKC": 1610612760, "ORL": 1610612753, "PHI": 1610612755, "PHX": 1610612756,
        "POR": 1610612757, "SAC": 1610612758, "SAS": 1610612759, "TOR": 1610612761,
        "UTA": 1610612762, "WAS": 1610612764,
    }

    try:
        team_id = team_code_to_id.get(team_code.upper())
        if not team_id:
            return jsonify({"error": "Invalid team code"}), 400

        logging.info(f"Fetching info for team ID {team_id} ({team_code})")

        team = next(t for t in teams.get_teams() if t["id"] == team_id)
        logging.info(f"Team found: {team}")

        standings_data = leaguestandingsv3.LeagueStandingsV3(season="2024-25").get_data_frames()[0]

        logging.info(f"Standings data retrieved with shape: {standings_data.shape}")

        row = standings_data[standings_data["TeamID"] == team_id]
        if row.empty:
            logging.error(f"No row found for team ID {team_id} in standings.")
            return jsonify({"error": "Team not found in standings"}), 404

        row = row.iloc[0]

        return jsonify({
            "id": team_id,
            "full_name": team["full_name"],
            "abbreviation": team["abbreviation"],
            "conference": row["Conference"],
            "division": row["Division"],
            "wins": int(row["WINS"]),
            "losses": int(row["LOSSES"])
        })
    except Exception as e:
        logging.exception("Error in /team-info route")
        return jsonify({"error": str(e)}), 500

@app.route("/team-roster/<team_code>", methods=["GET"])
def get_team_roster(team_code):
    from nba_api.stats.endpoints import commonteamroster

    team_code_to_id = {
        "ATL": 1610612737, "BOS": 1610612738, "BKN": 1610612751, "CHA": 1610612766,
        "CHI": 1610612741, "CLE": 1610612739, "DAL": 1610612742, "DEN": 1610612743,
        "DET": 1610612765, "GSW": 1610612744, "HOU": 1610612745, "IND": 1610612754,
        "LAC": 1610612746, "LAL": 1610612747, "MEM": 1610612763, "MIA": 1610612748,
        "MIL": 1610612749, "MIN": 1610612750, "NOP": 1610612740, "NYK": 1610612752,
        "OKC": 1610612760, "ORL": 1610612753, "PHI": 1610612755, "PHX": 1610612756,
        "POR": 1610612757, "SAC": 1610612758, "SAS": 1610612759, "TOR": 1610612761,
        "UTA": 1610612762, "WAS": 1610612764,
    }

    try:
        team_id = team_code_to_id.get(team_code.upper())
        if not team_id:
            return jsonify({"error": "Invalid team code"}), 400

        data = commonteamroster.CommonTeamRoster(team_id=team_id).get_dict()

        players = [
            {
                "id": row[14],  # PERSON_ID
                "name": row[3],
                "number": row[6],
                "position": row[7]
            }
            for row in data["resultSets"][0]["rowSet"]
        ]
        return jsonify({"roster": players})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
        

@app.route("/team-games/<team_code>", methods=["GET"])
def get_team_games(team_code):
    from nba_api.stats.static import teams
    from nba_api.stats.endpoints import teamgamelog

    team_map = {t["abbreviation"]: t["id"] for t in teams.get_teams()}
    team_id = team_map.get(team_code.upper())

    if not team_id:
        return jsonify({"error": "Invalid team code"}), 400

    try:
        log = teamgamelog.TeamGameLog(team_id=team_id, season="2024-25")
        df = log.get_data_frames()[0]

        games = []
        for _, row in df.iterrows():
            games.append({
                "date": row.get("GAME_DATE", "N/A"),
                "opponent": row.get("MATCHUP"),
                "result": f"{row.get('WL', '?')} {row.get('PTS', '?')}-{row.get('PTS_OPP', '?')}",
                "gameId": row.get("Game_ID", None)
            })

        return jsonify({"games": games})
    except Exception as e:
        import traceback
        traceback.print_exc() 
        return jsonify({"error": str(e)}), 500
    
# **Live Game Play-by-Play API Endpoint**
@app.route("/game-playbyplay/<game_id>", methods=["GET"])
def get_game_playbyplay(game_id):
    try:
        # Fetch play-by-play data
        playbyplay_data = playbyplay.PlayByPlay(game_id).get_dict()

        logging.info(f"Play-by-Play Data for game {game_id} received.")

        # Safely get the actions list
        actions = playbyplay_data.get('game', {}).get('actions', [])

        if not actions:
            logging.warning(f"No play-by-play actions found for game {game_id}")
            return jsonify({"error": "No play-by-play actions data found for this game."}), 404

        # Extract relevant fields
        detailed_actions = []
        for action in actions:
            detailed_actions.append({
                "actionNumber": action.get("actionNumber"),
                "clock": action.get("clock"),
                "timeActual": action.get("timeActual"),
                "period": action.get("period"),
                "teamTricode": action.get("teamTricode"),
                "actionType": action.get("actionType"),
                "subType": action.get("subType"),
                "descriptor": action.get("descriptor"),
                "qualifiers": action.get("qualifiers"),
                "playerName": action.get("playerName"),
                "shotResult": action.get("shotResult"),
                "pointsTotal": action.get("pointsTotal"),
                "description": action.get("description"),
                "scoreHome": action.get("scoreHome"),
                "scoreAway": action.get("scoreAway"),
                "assistPlayerName": action.get("assistPlayerName"),
                "assistPersonId": action.get("assistPersonId"),
                "assistTotal": action.get("assistTotal"),
            })

        # Store in MongoDB (optional)
        live_games_collection.update_one(
            {"gameId": game_id},
            {"$set": {"actions": detailed_actions}},
            upsert=True
        )

        return jsonify({"play_by_play": detailed_actions})

    except Exception as e:
        logging.error(f"Error fetching play-by-play data: {str(e)}")
        return jsonify({"error": f"Error retrieving play-by-play data: {str(e)}"}), 500

if __name__ == "__main__":
    fetch_live_games()  # Fetch initial live games data
    threading.Thread(target=move_past_games, daemon=True).start()  # Move past games at midnight
    app.run(port=5000, debug=True)