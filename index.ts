import { type Connect, type Plugin } from 'vite'
import { IncomingMessage, ServerResponse } from 'http'
import path from 'path'
import qs, { type ParsedQuery } from 'query-string'
import body from 'body'
import { fileURLToPath } from 'url'

export type MockApiOptions = {
	dir?: string
}

const SL = path.normalize('/')
const PLUGIN_NAME = '@wymjs/vite-mock-api'
const FULL_PLUGIN_NAME = `vite-plugin-${PLUGIN_NAME}`
const CONSOLE_NAME = `[${PLUGIN_NAME}]`

export function mockApi(options?: MockApiOptions): any {
	const plugin: Plugin = {
		name: FULL_PLUGIN_NAME,
		enforce: 'pre',
		configureServer(server) {
			const { dir = path.resolve(process.cwd(), 'mock-api') } = options || {}
			const updateTimeMap: Record<string, number> = {} // <檔案路徑, ms>

			console.log(`[LOG]${CONSOLE_NAME} 已開啟 mock-api 服務`)

			server.middlewares.use('/mock-api', useMock(dir, updateTimeMap))

			const onUpdateFile = updateFileListener(dir, updateTimeMap)
			server.watcher.on('add', onUpdateFile)
			server.watcher.on('change', onUpdateFile)
			server.watcher.on('unlink', onUpdateFile)
		},
	}

	return plugin
}

function toRelativeFilepath(filepath: string) {
	return `${path
		.relative(path.dirname(fileURLToPath(import.meta.url)), filepath)
		.replace(/[\\\/]/g, '/')}`
}

function updateFileListener(dir: string, updateTimeMap: Record<string, number>) {
	return (filepath: string) => {
		const [s1, s2] = filepath.split(dir)
		if (!(s1 === '' && s2[0] === SL)) return
		updateTimeMap[toRelativeFilepath(filepath)] = Date.now()
	}
}

function useMock(dir: string, updateTimeMap: Record<string, number>) {
	return async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
		if (!req.url) return next()

		let url: string

		try {
			const [_url, qsstr] = req.url.split('?')
			let query: ParsedQuery | undefined
			let _body: any

			url = _url

			if (qsstr) {
				query = qs.parse(qsstr)
			}

			_body = await new Promise(resolve => {
				body(req, res, (err, body) => {
					if (err || !body) {
						resolve(undefined)
						return
					}

					try {
						resolve(JSON.parse(body))
					} catch (error) {
						console.error(`[ERROR]${CONSOLE_NAME} ${url} JSON.parse body error`)
						console.error(error)
						resolve(undefined)
					}
				})
			})

			let filepath = toRelativeFilepath(`${dir}${SL}${query?.mockFile || 'index'}.js`)
			filepath += `?update=${updateTimeMap[filepath] || (updateTimeMap[filepath] = Date.now())}`
			const passData = { headers: req.headers, query, body: _body, req, res }
			const apiMap = (await import(filepath)).default

			if (typeof apiMap[url] !== 'function')
				throw new Error(`[ERROR]${CONSOLE_NAME} ${url} api 必須是 function!!`)

			res.end(JSON.stringify(apiMap[url](passData)))
			return
		} catch (error) {
			console.error(`[ERROR]${CONSOLE_NAME} ${url!} 解析錯誤`)
			console.error(error)
		}

		next()
	}
}
