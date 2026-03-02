const express = require("express");
const { getPosts } = require("../config/database");
const { getCachedPosts } = require("../services/scheduler");

const router = express.Router();

/**
 * GET /v2/lounge/postList
 * 메모리 캐시 우선, 없으면 DB 조회 (Access-Token 불필요)
 * Query: pageSize, type, stockCd, channelId (gardenapi와 동일 구성)
 */
router.get("/postList", (req, res) => {
  try {
    const { pageSize = "20", type = "0", stockCd, channelId } = req.query;
    const limit = parseInt(pageSize, 10) || 20;

    const cached = getCachedPosts();

    // 메모리 캐시가 있으면 캐시에서 응답
    if (cached.length > 0) {
      let result = [...cached];

      if (stockCd) {
        result = result.filter((p) => p.stockCd === stockCd);
      }

      if (type === "1") {
        result.sort((a, b) => (b.likeCnt || 0) - (a.likeCnt || 0));
      }

      return res.json(result.slice(0, limit));
    }

    // 캐시가 비어있으면 DB fallback
    const posts = getPosts({ stockCd, limit });

    if (type === "1") {
      posts.sort((a, b) => (b.like_cnt || 0) - (a.like_cnt || 0));
    }

    const result = posts.map((row) => {
      try {
        return JSON.parse(row.raw_json);
      } catch {
        return {
          postId: row.post_id,
          title: row.title,
          contents: row.contents,
          userNm: row.user_nm,
          regDt: row.reg_dt,
          postReadCnt: row.post_read_cnt,
          likeCnt: row.like_cnt,
          commentCnt: row.comment_cnt,
          stockCd: row.stock_cd,
          channelId: row.channel_id,
          channelNm: row.channel_nm,
        };
      }
    });

    res.json(result);
  } catch (error) {
    console.error("[GET /v2/lounge/postList] Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
