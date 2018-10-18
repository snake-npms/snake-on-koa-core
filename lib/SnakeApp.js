require('snake-utils')
const NODE_ENV = process.env.NODE_ENV || 'development'
const path = require('path')
const fs = require('fs')
const SnakeController = require('./SnakeController')
const SnakeOrm = require('snake-orm')
const Koa = require('koa')
let koa = new Koa()
class SnakeApp {
  static get SnakeModel () {
    return SnakeOrm.SnakeModel
  }
  static get SnakeController () {
    return SnakeController
  }
  constructor (options) {
    options = Object.assign({
      envPath: path.resolve(process.cwd(), 'config/env'),
      ormRcPath: path.resolve(process.cwd(), '.snakeormrc'),
      middlewaresPath: path.resolve(process.cwd(), 'app/middlewares'),
      controllersPath: path.resolve(process.cwd(), 'app/controllers')
    }, options)
    const frozenOptions = Object.freeze(options || {})
    Object.defineProperties(this, {
      'NODE_ENV': { "get": () => { return NODE_ENV } },
      'options': { "get": () => { return frozenOptions } },
      'PORT': { "get": () => { return this['options'].PORT || this['_env'] && this['_env']['PORT'] || 3000 } },
      '_koa': { "get": () => { return koa } }
    })
  }
  
  async register (options) {
    options = Object.assign({}, this.options, options)
    // Register Env
    const envPath = options['envPath']
    let envVars = require(envPath)
    Object.assign(envVars, envVars[this['NODE_ENV']])
    const frozenEnvVars = Object.freeze(envVars)
    Object.defineProperties(this, { '_envVars': { "get": () => { return frozenEnvVars } } })
    
    // Register Model
    const ormRcPath = options['ormRcPath']
    let snakeOrm = await SnakeOrm.initWithSnakeOrmRcFile(ormRcPath)
    Object.defineProperties(this, {
      'Models': { "get": () => { return snakeOrm._Models } }
    })
    Object.defineProperties(global, {
      "application": { "get": () => { return this } }
    })
    for (let modelName in this['Models']) {
      Object.defineProperties(global, {
        [modelName]: { "get": () => { return this['Models'][modelName] } }
      })
    }
    
    // load Koa about
    // middleware
    const middlewaresPath = options['middlewaresPath']
    fs.readdirSync(middlewaresPath).sort().forEach(file => {
      koa.use(require(path.resolve(middlewaresPath, file)))
    })
    //  controllers/routers
    const Routers = require(options['controllersPath'])
    this._registerRouter(Routers)
  
    Object.defineProperties(this, {
      '_orm': { "get": () => { return snakeOrm } }
    })
    return this
  }
  _registerRouter (Routers) {
    Object.isObject(Routers) && Object.keys(Routers).forEach((key) => {
      if (Object.isClass(Routers[key])) {
        let router = new Routers[key]()
        if (router instanceof SnakeController) {
          this._koa.use(router.routes()).use(router.allowedMethods())
        }
      } else {
        this._registerRouter(Routers[key])
      }
    })
  }
  
  startKoa (port) {
    this._koa.listen(port || this['PORT'], () => {
      console.log(`app start at: http://localhost:${this['PORT']}`)
    })
  }
}
module.exports = SnakeApp