const axios = require("axios");
const CommunityAuth = require("./communityAuth");
const { savePosts } = require("../config/database");

const FETCH_INTERVAL = 10 * 60 * 1000; // 10분

let timer = null;
let cachedPosts = []; // 최신 6개 메모리 캐시

function getCachedPosts() {
  return cachedPosts;
}

async function fetchAndSavePosts() {
  const custNum = process.env.CUST_NUM || "101834560";
  const hashedUserId = process.env.HASHED_USER_ID;

  try {
    console.log(`\n[Scheduler] ${new Date().toISOString()} - 게시글 수집 시작`);

    // 매번 새로 로그인 (access token 5분 만료)
    const auth = new CommunityAuth({ custNum, hashedUserId });
    const { accessToken } = await auth.login();

    const { data } = await axios.get(
      "https://proxy.edencrew.io/gardenapi/v2/lounge/postList",
      {
        params: { pageSize: "6", type: "0", stockCd: "Z000011", channelId: "0" },
        headers: { "Access-Token": accessToken },
        timeout: 15000,
      }
    );

    if (Array.isArray(data) && data.length > 0) {
      cachedPosts = data; // 메모리 캐시 먼저 갱신
      const titles = data.map((p) => p.title);
      console.log(`[Scheduler] ${data.length}개 게시글 메모리 캐시 갱신:`);
      titles.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));

      try {
        savePosts(data);
        console.log(`[Scheduler] DB 저장 완료`);
      } catch (dbError) {
        console.warn("[Scheduler] DB 저장 실패 (메모리 캐시는 정상):", dbError.message);
      }
    } else {
      console.log("[Scheduler] 조회된 게시글 없음");
    }
  } catch (error) {
    console.error("[Scheduler] 수집 실패:", error.message);
  }
}

function start() {
  console.log("[Scheduler] 시작 - 10분 간격으로 게시글 수집");

  // 서버 시작 시 즉시 1회 실행
  fetchAndSavePosts();

  timer = setInterval(fetchAndSavePosts, FETCH_INTERVAL);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[Scheduler] 중지됨");
  }
}

module.exports = { start, stop, fetchAndSavePosts, getCachedPosts };
