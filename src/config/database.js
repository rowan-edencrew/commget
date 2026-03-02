const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "../../data/comm_get.db");

let db;

function getDb() {
  if (!db) {
    const fs = require("fs");
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initTables();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cust_num TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      login_response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_auth_tokens_cust_num ON auth_tokens(cust_num);

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id TEXT NOT NULL UNIQUE,
      user_id TEXT,
      channel_id TEXT,
      stock_cd TEXT,
      type TEXT,
      title TEXT,
      contents TEXT,
      post_read_cnt INTEGER,
      like_cnt INTEGER,
      comment_cnt INTEGER,
      user_nm TEXT,
      profile_img TEXT,
      channel_nm TEXT,
      thumb_url TEXT,
      liked_yn TEXT,
      follow_yn TEXT,
      reg_dt TEXT,
      mod_dt TEXT,
      top_comment TEXT,
      raw_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_posts_stock_cd ON posts(stock_cd);
    CREATE INDEX IF NOT EXISTS idx_posts_reg_dt ON posts(reg_dt);
  `);
  console.log("[Database] Tables initialized");
}

function saveToken({ custNum, accessToken, refreshToken, loginResponse }) {
  const db = getDb();

  const existing = db
    .prepare("SELECT id FROM auth_tokens WHERE cust_num = ?")
    .get(custNum);

  if (existing) {
    db.prepare(
      `UPDATE auth_tokens
       SET access_token = ?, refresh_token = ?, login_response = ?, updated_at = CURRENT_TIMESTAMP
       WHERE cust_num = ?`
    ).run(accessToken, refreshToken, loginResponse, custNum);
    console.log("[Database] Token updated for custNum:", custNum);
  } else {
    db.prepare(
      `INSERT INTO auth_tokens (cust_num, access_token, refresh_token, login_response)
       VALUES (?, ?, ?, ?)`
    ).run(custNum, accessToken, refreshToken, loginResponse);
    console.log("[Database] Token saved for custNum:", custNum);
  }
}

function getToken(custNum) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM auth_tokens WHERE cust_num = ? ORDER BY updated_at DESC LIMIT 1")
    .get(custNum);
}

function getAllTokens() {
  const db = getDb();
  return db.prepare("SELECT * FROM auth_tokens ORDER BY updated_at DESC").all();
}

function savePosts(posts) {
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO posts (post_id, user_id, channel_id, stock_cd, type, title, contents,
      post_read_cnt, like_cnt, comment_cnt, user_nm, profile_img, channel_nm, thumb_url,
      liked_yn, follow_yn, reg_dt, mod_dt, top_comment, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(post_id) DO UPDATE SET
      post_read_cnt=excluded.post_read_cnt, like_cnt=excluded.like_cnt,
      comment_cnt=excluded.comment_cnt, liked_yn=excluded.liked_yn,
      follow_yn=excluded.follow_yn, mod_dt=excluded.mod_dt,
      top_comment=excluded.top_comment, raw_json=excluded.raw_json,
      updated_at=CURRENT_TIMESTAMP
  `);

  const insertMany = db.transaction((items) => {
    for (const p of items) {
      upsert.run(
        p.postId, p.userId, p.channelId, p.stockCd, p.type, p.title, p.contents,
        p.postReadCnt, p.likeCnt, p.commentCnt, p.userNm, p.profileImg, p.channelNm,
        p.thumbUrl, p.likedYn, p.followYn, p.regDt, p.modDt,
        p.topCommentInfo ? JSON.stringify(p.topCommentInfo) : null,
        JSON.stringify(p)
      );
    }
  });

  insertMany(posts);
  console.log(`[Database] ${posts.length}개 게시글 저장 완료`);
}

function getPosts({ stockCd, limit = 20 } = {}) {
  const db = getDb();
  if (stockCd) {
    return db.prepare("SELECT * FROM posts WHERE stock_cd = ? ORDER BY reg_dt DESC LIMIT ?").all(stockCd, limit);
  }
  return db.prepare("SELECT * FROM posts ORDER BY reg_dt DESC LIMIT ?").all(limit);
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, saveToken, getToken, getAllTokens, savePosts, getPosts, close };
