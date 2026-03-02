require("dotenv").config();

const CommunityAuth = require("./src/services/communityAuth");
const { saveToken, getToken, close } = require("./src/config/database");

async function test() {
  const custNum = process.env.CUST_NUM || "101834560";
  const hashedUserId = process.env.HASHED_USER_ID;

  console.log("=".repeat(60));
  console.log("커뮤니티 서버 로그인 테스트");
  console.log("=".repeat(60));
  console.log(`custNum: ${custNum}`);
  console.log(`hashedUserId: ${hashedUserId || "(없음 - SHA-256 사용)"}`);
  console.log(`keyGenUrl: https://gardenapi.nhsec.com/apiKeyPairGen`);
  console.log();

  const auth = new CommunityAuth({ custNum, hashedUserId });

  try {
    // 1. 해시 검증
    console.log("[Test 1] SHA-256 해시 검증");
    const hashed = auth.makeHashData(custNum);
    console.log(`  Input: ${custNum}`);
    console.log(`  Hashed: ${hashed}`);
    // 로그에서 확인된 해시값과 비교
    const expectedHash = "2Q1I2a50WtjuZSWMHmMmylZYsNYYCMh9LpgGRPFZk1g=";
    if (hashed === expectedHash) {
      console.log(`  PASS - 해시값이 기존 로그와 일치합니다`);
    } else {
      console.log(`  WARN - 기대값: ${expectedHash}`);
      console.log(`  WARN - 해시가 다를 수 있습니다 (custNum이 다르면 정상)`);
    }
    console.log();

    // 2. 로그인 테스트
    console.log("[Test 2] 커뮤니티 서버 로그인");
    const result = await auth.login();

    console.log();
    console.log("[Test 2 Result]");
    console.log(`  Access Token: ${result.accessToken ? "발급됨 (" + result.accessToken.length + " chars)" : "미발급"}`);
    console.log(`  Refresh Token: ${result.refreshToken ? "발급됨 (" + result.refreshToken.length + " chars)" : "미발급"}`);
    console.log(`  Access Token 값: ${result.accessToken || "N/A"}`);
    console.log(`  Refresh Token 값: ${result.refreshToken || "N/A"}`);

    if (result.accessToken) {
      console.log(`  PASS - Access Token 정상 발급`);
    } else {
      console.log(`  FAIL - Access Token 미발급`);
    }

    if (result.refreshToken) {
      console.log(`  PASS - Refresh Token 정상 발급`);
    } else {
      console.log(`  WARN - Refresh Token 미발급 (서버 설정에 따라 정상일 수 있음)`);
    }
    console.log();

    // 3. DB 저장 테스트
    console.log("[Test 3] DB 저장 테스트");
    saveToken({
      custNum,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken || "",
      loginResponse: JSON.stringify(result.body || ""),
    });

    const saved = getToken(custNum);
    console.log(`  DB에서 조회: ${saved ? "성공" : "실패"}`);
    if (saved) {
      console.log(`  저장된 Access Token: ${saved.access_token.substring(0, 30)}...`);
      console.log(`  저장 시각: ${saved.created_at}`);
      console.log(`  PASS - DB 저장 및 조회 성공`);
    }

    console.log();
    console.log("=".repeat(60));
    console.log("테스트 완료 - 모든 결과 위 로그 확인");
    console.log("=".repeat(60));
  } catch (error) {
    console.error();
    console.error("FAIL - 테스트 실패:", error.message);
    if (error.response) {
      console.error("  Response status:", error.response.status);
      console.error("  Response data:", JSON.stringify(error.response.data));
    }
  } finally {
    close();
  }
}

test();
