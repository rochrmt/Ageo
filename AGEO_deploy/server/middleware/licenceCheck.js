'use strict'
const { verify } = require('../utils/licence')

module.exports = function licenceCheck(req, res, next) {
  const result = verify(process.env.LICENCE_KEY ?? '')
  if (!result.valid) {
    return res.status(402).json({
      error:   'Licence invalide ou expirée',
      reason:  result.reason,
      expired: result.expired ?? false,
    })
  }
  req.licence = result
  next()
}
