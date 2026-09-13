#!/usr/bin/env node
/**
 * OCR 探针（spike 工具，非产品代码）
 *
 * 目的：以最小依赖回答一个问题——「这张截图上的文字，PaddleOCR 能不能认出来」。
 * 它不依赖 Electron，不依赖 aramgg 的业务逻辑，直接使用 resources/paddleocr 下的模型。
 *
 * 用法：
 *   node spike/ocr-probe.mjs <图片路径> [--crop x,y,w,h] [--center] [--scale 2] [--out 结果.json]
 *
 *   --crop x,y,w,h   只识别指定像素区域
 *   --center         只识别画面中央区域（默认宽 70%、高 30%，可用 --center-region 覆盖）
 *   --scale n        识别前放大 n 倍（小字号卡片标题值得放大试试）
 *   --out path       把完整结果写成 JSON（终端中文可能乱码，写文件更可靠）
 */
import path from 'node:path'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(here, '..')

function parseArgs(argv) {
  const out = {
    image: null,
    crop: null,
    center: null,
    scale: 1,
    outJson: null,
  }
  const positional = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--crop') out.crop = argv[++i]
    else if (arg === '--center') out.center = argv[++i] || '0.70,0.30'
    else if (arg === '--scale') out.scale = Number(argv[++i]) || 1
    else if (arg === '--out') out.outJson = argv[++i]
    else positional.push(arg)
  }
  out.image = positional[0] || null
  return out
}

function fail(message) {
  console.error('ERROR: ' + message)
  process.exit(1)
}

function resolveModelPaths() {
  const dataDir = process.env.ARAMGG_PADDLEOCR_MODEL_DIR
  const candidates = [
    dataDir,
    path.join(APP_ROOT, 'resources', 'paddleocr'),
  ].filter(Boolean)

  for (const dir of candidates) {
    const det = path.join(dir, 'det', 'inference.onnx')
    const rec = path.join(dir, 'rec', 'inference.onnx')
    const yml = path.join(dir, 'rec', 'inference.yml')
    if (existsSync(det) && existsSync(rec) && existsSync(yml)) {
      return { dir, det, rec, yml }
    }
  }
  fail('未找到 PaddleOCR 模型。期望 ' + path.join(APP_ROOT, 'resources', 'paddleocr'))
}

/**
 * Windows 下 onnxruntime-node 的原生 .node 需要同目录的 dll 可被搜索到，
 * 否则 import 会直接失败。这里复刻 aramgg 的做法：把原生目录前置到 PATH。
 */
function ensureNativeDllPath() {
  if (process.platform !== 'win32') return null
  const parts = ['bin', 'napi-v6', process.platform, process.arch]
  let pkgDir = null
  try {
    pkgDir = path.dirname(require.resolve('onnxruntime-node/package.json'))
  } catch {
    return null
  }
  const candidates = [
    process.env.ARAMGG_ONNXRUNTIME_NATIVE_DIR,
    pkgDir ? path.join(pkgDir, ...parts) : null,
    path.join(APP_ROOT, 'node_modules', 'onnxruntime-node', ...parts),
  ].filter(Boolean)

  for (const dir of candidates) {
    if (
      existsSync(path.join(dir, 'onnxruntime_binding.node')) &&
      existsSync(path.join(dir, 'onnxruntime.dll'))
    ) {
      const entries = String(process.env.PATH || '').split(path.delimiter).filter(Boolean)
      if (!entries.includes(dir)) process.env.PATH = [dir, ...entries].join(path.delimiter)
      return dir
    }
  }
  return null
}

function readCharacterDictionary(ymlText) {
  const lines = String(ymlText || '').split(/\r?\n/)
  const start = lines.findIndex((line) => /^\s*character_dict:\s*$/.test(line))
  if (start === -1) fail('inference.yml 里找不到 character_dict')
  const chars = []
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\S/.test(lines[i])) break
    const m = /^\s*-\s?(.*)$/.exec(lines[i])
    if (m) chars.push(m[1].replace(/^['"]|['"]$/g, ''))
  }
  if (!chars.length) fail('character_dict 为空')
  return ['', ...chars]
}

function parseCrop(spec) {
  const parts = String(spec).split(',').map((v) => Number(v))
  if (parts.length !== 4 || parts.some((v) => !Number.isFinite(v))) {
    fail('--crop 需要四个数字：x,y,w,h')
  }
  return { left: parts[0], top: parts[1], width: parts[2], height: parts[3] }
}

function centerCrop(spec, width, height) {
  const parts = String(spec).split(',').map((v) => Number(v))
  const ratioW = Number.isFinite(parts[0]) ? parts[0] : 0.7
  const ratioH = Number.isFinite(parts[1]) ? parts[1] : 0.3
  const w = Math.round(width * ratioW)
  const h = Math.round(height * ratioH)
  return {
    left: Math.round((width - w) / 2),
    top: Math.round((height - h) / 2),
    width: w,
    height: h,
  }
}

function inside(crop, width, height) {
  return {
    left: Math.max(0, Math.min(crop.left, width - 1)),
    top: Math.max(0, Math.min(crop.top, height - 1)),
    width: Math.max(1, Math.min(crop.width, width - Math.max(0, crop.left))),
    height: Math.max(1, Math.min(crop.height, height - Math.max(0, crop.top))),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.image) {
    fail('用法：node spike/ocr-probe.mjs <图片路径> [--crop x,y,w,h] [--center] [--scale 2] [--out 结果.json]')
  }
  if (!existsSync(args.image)) fail('图片不存在：' + args.image)

  const sharp = (await import('sharp')).default
  const models = resolveModelPaths()
  const nativeDir = ensureNativeDllPath()

  const meta = await sharp(args.image).metadata()
  const fullWidth = meta.width
  const fullHeight = meta.height

  let crop = null
  if (args.crop) crop = inside(parseCrop(args.crop), fullWidth, fullHeight)
  else if (args.center) crop = inside(centerCrop(args.center, fullWidth, fullHeight), fullWidth, fullHeight)

  let pipeline = sharp(args.image).ensureAlpha()
  if (crop) pipeline = pipeline.extract(crop)
  if (args.scale !== 1) {
    const scaledW = Math.round((crop ? crop.width : fullWidth) * args.scale)
    pipeline = pipeline.resize({ width: scaledW, kernel: 'nearest' })
  }
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true })

  const [{ PaddleOcrService }, ort] = await Promise.all([
    import('paddleocr'),
    import('onnxruntime-node'),
  ])

  const charactersDictionary = readCharacterDictionary(readFileSync(models.yml, 'utf8'))
  const service = await PaddleOcrService.createInstance({
    ort,
    detection: {
      modelBuffer: toArrayBuffer(readFileSync(models.det)),
      maxSideLength: 960,
      minimumAreaThreshold: 4,
      textPixelThreshold: 0.6,
      paddingBoxVertical: 0.4,
      paddingBoxHorizontal: 0.6,
    },
    recognition: {
      modelBuffer: toArrayBuffer(readFileSync(models.rec)),
      charactersDictionary,
      imageHeight: 48,
    },
  })

  const items = await service.recognize({
    width: info.width,
    height: info.height,
    data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
  })

  const summary = {
    image: args.image,
    imageSize: { width: fullWidth, height: fullHeight },
    crop,
    scale: args.scale,
    modelDir: models.dir,
    nativeDir,
    itemCount: Array.isArray(items) ? items.length : 0,
    texts: (items || []).map((item, index) => ({
      index,
      text: item?.text ?? null,
      confidence: item?.confidence ?? item?.score ?? null,
      box: item?.box ?? item?.bbox ?? null,
    })),
  }

  console.log(JSON.stringify(summary, null, 2))

  if (args.outJson) {
    mkdirSync(path.dirname(path.resolve(args.outJson)), { recursive: true })
    writeFileSync(args.outJson, JSON.stringify({ ...summary, rawItems: items }, null, 2), 'utf8')
    console.log('\n完整结果已写入: ' + path.resolve(args.outJson))
  }

  if (typeof service.destroy === 'function') await service.destroy()
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

main().catch((error) => {
  console.error('探针执行失败：')
  console.error(error)
  process.exit(1)
})
