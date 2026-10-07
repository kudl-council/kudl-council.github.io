/* ============================================================
   사이트 설정 파일  (설치할 때 이 파일 하나만 고치면 됩니다)
   ------------------------------------------------------------
   1) siteName   : 화면 맨 위에 보이는 이름
   2) ownerEmail : 학생회 공용 gmail 주소 (= 최고 관리자)
                   → 이 계정은 항상 모든 권한을 가집니다.
                   → firestore.rules 파일 안의 주소와 "똑같이" 적어야 합니다.
   3) firebase   : Firebase 콘솔에서 복사한 값 4개를 붙여넣기
                   (비워두면 '데모 모드'로 열려서 화면만 구경할 수 있어요)
   ============================================================ */
window.SITE_CONFIG = {
  siteName: "고려대학교 생명과학부 학생회",

  ownerEmail: "kudl.council@gmail.com",

  firebase: {
    apiKey: "AIzaSyDkejy5o_8jyABP1OO91hXqoEhbXdvOwC4",
    authDomain: "kudl-council.firebaseapp.com",
    projectId: "kudl-council",
    appId: "1:263745328241:web:67d60ad34f12b14463f7d0"
  }
};
