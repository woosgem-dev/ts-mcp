# ts-mcp 회고

잘된 것, 깨진 것, 다르게 할 것.

## 아키텍처 결정

### TS Language Service API 직접 사용

LSP 서버를 래핑하는 대신 TypeScript Language Service API를 직접 썼다. 이게 맞았다.

우선 IPC 오버헤드가 없다. 심볼 조회, 콜 히어라키, 진단 전부 in-process로 돌아간다. 직렬화 왕복이 없으니 빠르다. 그리고 `prepareCallHierarchy`나 `getImplementationAtPosition` 같은 API는 LSP로 완전히 노출이 안 된다. 직접 접근하니까 `impact_analysis`를 프로토콜 제약 없이 복합 도구로 만들 수 있었다.

대신 TypeScript에 종속된다. 다른 언어는 지원 못 한다. TS 전용 MCP 서버니까 이건 괜찮다.

### 3계층 아키텍처

Project, Service, MCP 계층으로 나눈 건 좋은 선택이었다. 도구 추가가 기계적이다. Service 계층에 순수 함수 하나 쓰고 MCP 등록 래퍼 씌우면 끝. 테스트도 MCP 프로토콜 없이 Service 계층만 직접 찌른다.

## 버그와 수정

### Workspace 경로 해석 (제일 큰 놈)

서버가 `--workspace .`를 받으면 위치 기반 도구가 전부 깨졌다. 추적하기 귀찮은 버그였다.

`loadTsConfig('.')`가 상대 경로로 파일명을 돌려준다. `files` Map에 상대 경로 키가 들어간다. 근데 `resolveFileName()`은 `path.resolve()`로 절대 경로를 만든다. 그러니 Map 조회가 실패한다. 절대 경로 키로 상대 경로 키를 찾으니까.

실마리는 이거였다. `diagnostics`는 동작하는데 상대 경로를 반환했다. `document_symbols`는 모든 심볼이 `line: 1`이었다(빈 콘텐츠라 오프셋이 전부 1행으로 매핑). `workspace_symbols`만 정상이었는데 SymbolIndexer가 파일을 직접 읽어서 Map을 안 거치기 때문이다.

수정은 한 줄이다. 생성자에서 `this.workspace = path.resolve(workspace)`. 추가로 `getCurrentDirectory`가 원래 파라미터 클로저 대신 `this.workspace`를 쓰도록 바꿨다.

경계에서 경로는 항상 정규화하자. 호출자가 절대 경로를 넘길 거라고 가정하지 말 것.

### MCP 형제 에러 전파 (수정 불가)

Claude Code가 MCP 도구를 여러 개 병렬 호출할 때 하나가 실패하면 형제 호출까지 에러가 전파된다. 클라이언트 쪽 동작이라 서버에서 할 수 있는 게 없다.

모든 핸들러를 try-catch로 감싸고 throw 대신 `isError: true`를 반환하게 했다. 서버 크래시는 막지만 클라이언트가 형제 호출에 에러를 보여주는 건 여전히 생길 수 있다.

### 위치 범위 검사

범위 밖 행 번호가 `resolvePosition()`과 `toOffset()`을 죽였다. `Math.min(line - 1, lines.length)`로 클램핑. 처음부터 있었어야 할 코드다.

## MCP 도구 설계

### 도구 설명문이 곧 에이전트 지시문이다

생각보다 영향이 컸다. "심볼이 정의된 위치를 찾습니다" 같은 설명은 너무 수동적이었다. 에이전트가 계속 grep으로 폴백했다.

지시형으로 고치니까 행동이 실제로 달라졌다.
- 이전: `"Find where a symbol is defined"`
- 이후: `"Jump to the definition of a symbol at a given position. Requires file, line, and column. MUST use this instead of grep/ripgrep to find where a symbol is defined."`

다음 단계 힌트도 효과가 있었다. 도구 응답 끝에 "Next: Use find_references to find all usages"를 붙이면 에이전트가 멈추지 않고 자연스럽게 다음 도구를 호출한다.

### 도구 어노테이션으로 자동 승인

MCP 클라이언트는 도구 호출마다 권한을 묻는다. 읽기 전용 서버에서 이건 그냥 마찰이다.

모든 도구 등록에 `{ readOnlyHint: true }`를 붙였다. 클라이언트에게 수정하는 도구가 아니라고 알려주는 거다. 이걸 존중하는 클라이언트는 도구별 승인 없이 자동으로 통과시킬 수 있다. 서버 쪽 변경으로 클라이언트 UX 문제를 해결한 셈이다. 사용자가 따로 설정할 것도 없다.

### 예외 대신 에러 응답

MCP 핸들러에서 throw하면 연결이 끊긴다. `{ isError: true, content: [...] }`를 반환하면 서버는 계속 살아있고 에이전트도 에러 메시지를 받아서 다음 행동을 정할 수 있다.

## 개발 프로세스

### 에이전트 주도 TDD

16개 태스크로 쪼개고 테스트 작성, 실행, 구현, 검증 순서를 반복했다. 에이전트가 이 흐름을 기계적으로 돌려서 매 단계마다 동작하는 코드가 나왔다. 테스트 픽스처가 핵심이었다. 인터페이스, 구현체, 호출 체인을 가진 소규모 TS 프로젝트 하나가 모든 도구에 의미 있는 테스트 대상을 줬다. 이게 없었으면 테스트할 게 없었을 거다.

### SymbolIndexer

처음에 `workspace_symbols`는 Language Service의 `getNavigateToItems()`를 썼다. 동작은 하는데 큰 프로젝트에서 느렸다. TS AST 순회로 심볼 인덱스를 미리 빌드하는 걸로 바꾸니까 체감될 정도로 빨라졌다. 인덱스는 디스크에 캐시하고 파일 해시로 무효화한다. `--no-cache`로 강제 재빌드도 된다.

## 운영

### 공개 레포에 개인정보

push하고 나서 발견했다. 계획 문서에 로컬 파일 경로(`/Users/username/...`)가 남아있었고, 다른 레포에서는 git commit author에 실명이 들어가 있었다.

커밋 전에 문서를 한 번 훑자. 개발 중 생성된 계획 문서에는 로컬 경로가 들어갈 수밖에 없다. `git add` 전에 확인해야 한다. 그리고 `git config user.name`과 `user.email`은 첫 커밋 전에 공개용으로 설정해 놓자. 나중이 아니라.

이미 실명이 push된 레포는 `git-filter-repo`로 커밋 히스토리를 재작성했다.
