@wymjs/vite-mock-api
===

> 簡單的 mock api 功能

## 安裝

```shell
$ pnpm i -D @wymjs/vite-mock-api query-string body
```

## 使用

1. vite 配置

```typescript
import { defineConfig } from 'vite'
import { mockApi } from '@wymjs/vite-mock-api'

export default () => {
  return defineConfig({
    plugins: [
      // 配置下去就會自動同步 tsconfig.compilerOptions.paths 到 alias 裡
      // 參數可傳可不傳
      mockApi({
        // mock 檔案存方的相對路徑目錄名，預設：mock-api
        dir: 'mock-api',
      }),
    ],
  })
}
```

2. 撰寫 mock api 方法(改動後不用重啟，重 call 一次 api 就會看到新的了)

```javascript
// /mock-api/user.js
let count = 0

export default {
  // 最基本的方式，key 為 api 路徑，方法返回的是最終值
  // 因為有用變量存著，所以每次調用返回都會持續增加
  '/api/count': () => {
    count += 1
    return count
  },
  // 複雜一點的寫法
  '/api/login': ({ res, body, query }) => {
    // res, req 皆為 ViteDevServer 的 res, req
    // 所以有要改變 header 的話可以像這樣調用
    res.setHeader('Content-Type', 'application/json; charset=utf-8')

    // body 為 fetch 傳進來的 body
    if (!(body.username === 'MANAGER' && body.password === '1234')) {
      // 改變狀態碼
      res.statusCode = 500
      return {
        code: 500,
        message: '帳號或密碼錯誤',
        data: null,
      }
    }

    return {
      code: 200,
      message: '成功',
      data: {
        // query 為路由參數，不過會在內部轉成物件的形式給這裡使用
        token: String(Date.now() + (query.expiredMinutes || 1) * 1000 * 60),
      },
    }
  },
}
```

3. 調用

```typescript
// 發送請求到如下路徑就可以打到本地的 mock api 方法
// /mock-api{mock檔的key}?[mockFile=檔名]
// mockFile 不傳的話就是默認找 mock 目錄下的 index.js
fetch('/mock-api/api/count?mockFile=user')
  .then(res => {
    console.log(res) // 1
  })

// api/login 同理
```
