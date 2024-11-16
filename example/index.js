const UpdateIconfont = require('../index')
const path = require('path')

const update = new UpdateIconfont(
  {
    url: 'https://www.iconfont.cn/api/project/download.zip?spm=a313x.manage_type_myprojects.i1.d7543c303.117e3a81LTzeDL&pid=4747974&ctoken=ckki3yv-tpBrOZX4PEbeAvZg',
    cookie: 'cna=JAh4Hw9mix4CAd3Z0y2Y93LJ; EGG_SESS_ICONFONT=dzIFRF6UFHpWicZx2_bPckwA7YmSFBKDZ3pj8XNEF7XmZMqADGh1tV_ehc2pp7QpiFDIDYAXp_JGSdKB29SKrnBaNYcF99tJYN_tNHr-hlRdgByk4YU1uG7jw6sWwejk; xlly_s=1; ctoken=ckki3yv-tpBrOZX4PEbeAvZg; u=859304; u.sig=YePSb-8PWb9aGQDWB27F6w5uobJv2Hcgjouo1Hke2rE; tfstk=fvtSI7szd7VSCz0r5JHVG_Qtz7jBRBiZOJ6pIpEzpgI89WpOgL-P4pzBOI9OJ3JF2HsBGBOyzgLyR9OweB_nE65dOBJpzxoZbLvlxMCI_coN1vewzQaL2MHdMTXCaIzzhLvlx-249V8vEW6l39ORvBIAk9XdvTEdwxwAdsERpuBLMx1cpMBRvupvHTXCe9Qp9KHfKsCKgx21d41kFxyHAF4Ioq95GkE_IT_-hLzUYkzPEafOksZd3n65P1pJq91kgtK2cN74LbIvIERRhGi4yGpXJCT9tVzcVpLJtZOoir12kEJpmZeLyKtCNNKRlJZHCLXp9wTm1lW54E_6VUD3MLdNNFIkLRGyhNTfStQYdzIy7d-hW3n7ss7GdQ526cEfDwIyNl51ZUzQkcqCh1kjhy4nrXZwQ9feN8_RnT_qhxNJ-aBch1KEhzYhytX5gxMbwef..; isg=BAYG6rUTnSlyCUiEOrwRx3WtV_yIZ0ohnzWF1fAu6ikE86QNWPUEMJHFyy8_20I5',
    output: path.join(__dirname, './src/assets/iconfont'),
    runDir: path.join(__dirname, './'),
  }
)
update.main()
