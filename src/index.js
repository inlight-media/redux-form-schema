import each from 'lodash/each'
import get from 'lodash/get'
import isFunction from 'lodash/isFunction'
import isUndefined from 'lodash/isUndefined'
import isString from 'lodash/isString'
import set from 'lodash/set'
import startCase from 'lodash/startCase'
import validator, { isInt } from 'validator'

import errorMessages from './error-messages'

export function buildValidationFn(schema) {
  return (formValues) => {
    const errors = {}

    if (!formValues) {
      return errors
    }

    // TODO this could possibly be done with lodash transform
    each(schema, (definition, fieldRef) => {
      const { label, required, type, validate, error } = definition
      const fieldValue = get(formValues, fieldRef)
      const fieldValueExists = isDefined(fieldValue)

      // required is active if it is `true` or a function that returns
      // true when passed the form values as an argument. This allows
      // you to perform conditional requires based on other values in
      // the form
      const isRequired = required &&
        (required === true) ||
        (isFunction(required) && required(formValues))

      // validate required
      if (isRequired && !fieldValueExists) {
        addErrorToField(errors, fieldRef, error || errorMessages('required', label))
      }

      // validate simple type validators
      if (fieldValueExists && type && !validates(type, fieldValue)) {
        // use custom error message or fallback to default
        const message = error || errorMessages(type, label)
        addErrorToField(errors, fieldRef, message)
      }

      // validate complex validations
      if (validate) {

        // only validate if rule doesnt exist, or rule exists and the
        // function returns true when passed formValues

        each(validate, (opts, id) => {
          // TODO support array of validate's which will allow multiple
          // rule based validations

          // skip validation if we have no field value
          if (!fieldValueExists) {
            return
          }

          let isValid
          const customValidator = isFunction(opts) && opts

          if (customValidator) {
            isValid = customValidator(formValues, fieldValue)
          } else {
            isValid = validates(id, fieldValue, opts)
          }

          if (!isValid) {
            // use custom error message or fallback to default
            const message = error || errorMessages(id, label, opts)
            addErrorToField(errors, fieldRef, message)
          }
        })
      }
    })

    return errors
  }
}

function addErrorToField(errors, fieldRef, errorMessage) {
  const field = get(errors, fieldRef)

  if (field) return field.push(errorMessage)

  set(errors, fieldRef, [errorMessage])
}

// Get validator by string (the part after 'is' in validator methods)
// validatorId = 'email' => validator.isEmail
// validatorId = 'date' => validator.isDate
// validatorId = 'creditCard' => validator.isCreditCard
function getValidator(validatorId) {
  const validatorIdInStartCase = startCase(validatorId)
  const validatorFn = validator[`is${validatorIdInStartCase}`]
  return validatorFn
}

/**
 * run a validator with value and options
 * @param {String} validatorId the id of `validator` method
 * @param {String} value to run against validator
 * @param {Mixed} ...opts if applicable
 */
function validates(validatorId, value, opts) {
  const validatorFn = getValidator(validatorId)
  if (!validatorFn) {
    return console.warn(`Missing validator for '${validatorId}'`)
  }

  switch (validatorId) {
    case 'length':
      // isLength is a case where we don't follow the API of
      // validator.js which accepts two arguments for length that
      // doesn't play nice with a single object definition (like in
      // our schemas). This also is consistent with how min/max is
      // defined in the isInt validator
      return validatorFn(value, opts.min, opts.max)
    default:
      return validatorFn(value, opts)
  }
}

function isDefined(value) {
  return (typeof value !== 'undefined') && String(value).length > 0
}
