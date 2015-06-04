var clone = require('clone');
var speedDate = require('speed-date');

var dateTimeFormat = speedDate.UTC('YYYYMMDDHHmm');
var dateFormat = speedDate.UTC('YYYYMMDD');

var fixed = module.exports = function (spec) {
	if (!(this instanceof fixed))
		return new fixed(spec);

	this.spec = processSpec(spec);
}

fixed.prototype.generate = function (data) {
	var spec = this.spec;

	var buffer = new Buffer(spec.totalLength);
	buffer.fill(' ');

	spec.fields.forEach(function (field) {
		var value = findValue(data, field);
		value = transformValue(value, field, spec.supportsUnicode);

		if (typeof value === 'undefined' || value === null)
			return;

		buffer.write(value, field.startIndex, field.length, spec.encoding);
	});

	if (spec.recordEnding)
		buffer.write(spec.recordEnding, spec.length, spec.recordEnding.length, spec.encoding);

	return buffer;
}

function processSpec(spec) {
	spec = clone(spec);

	// encoding

	if (!spec.encoding)
		spec.encoding = 'utf8';

	if (typeof spec.supportsUnicode === 'undefined')
		spec.supportsUnicode = spec.encoding != 'ascii';

	// format

	if (typeof spec.recordEnding === 'undefined')
		spec.recordEnding = '\r\n';

	// field defaults

	if (typeof spec.defaultTrueValue === 'undefined')
		spec.defaultTrueValue = '1';

	if (typeof spec.defaultFalseValue === 'undefined')
		spec.defaultFalseValue = '0';

	// fields

	spec.fields.forEach(function (field) {
		if (!spec.zeroIndexedStartingPosition)
			field.startIndex = field.startingPosition - 1;
		else
			field.startIndex = field.startingPosition;

		if (typeof field.trueValue === 'undefined')
			field.trueValue = spec.defaultTrueValue;

		if (typeof field.falseValue === 'undefined')
			field.falseValue = spec.defaultFalseValue;

		if (field.possibleValues && typeof field.possibleValues.indexOf !== 'function')
			throw new Error('possibleValues of field ' + field.key + ' must be an array');
	});

	// record length

	var requiredLength = Math.max.apply(null, spec.fields.map(function (field) {
		return field.startIndex + field.length;
	}));

	if (typeof spec.length === 'undefined')
		spec.length = requiredLength;

	if (spec.length < requiredLength)
		throw new Error('spec length is ' + spec.length + ' but ' + requiredLength + ' is needed');

	spec.totalLength = spec.length;

	if (spec.recordEnding)
		spec.totalLength += spec.recordEnding.length;

	return spec;
}

function findValue(data, field) {
	if (typeof field.fixedValue !== 'undefined')
		return field.fixedValue;

	var value = field.defaultValue;

	if (typeof data[field.key] !== 'undefined')
		value = data[field.key];

	if (field.required && (typeof value === 'undefined' || value === null))
		throw new Error('field ' + field.key + ' is required, but cannot be resolved');

	if (typeof value !== 'undefined' && field.possibleValues && field.possibleValues.indexOf(value) === -1)
		throw new Error('value "' + value + '" is not possible for field ' + field.key);

	return value;
}

function transformValue(value, field, supportsUnicode) {
	function err(msg) {
		if (!msg)
			msg = 'invalid';
		return new Error(['value is', msg, 'for field', field.key, '\n', value].join(' '));
	}

	if (typeof value === 'undefined' || value === null) {
		switch (field.type) {
			case 'integer':
				value = 0;
				break;

			default:
				return value;
		}
	}

	switch (field.type) {
		case 'string':
			if (!(value instanceof String))
				value = value.toString();
			if (!supportsUnicode)
				value = value.replace(/[^\x00-\x7F]/g, '*');
			if (value.length > field.length)
				throw err('too long');
			return value;

		case 'integer':
			if (typeof value !== 'number')
				throw err('not a number');
			if (value % 1 !== 0)
				throw err('not an integer');
			value = value.toString();
			if (value.length > field.length)
				throw err('too long');
			if (value.length < field.length)
				value = new Array(field.length - value.length + 1).join('0') + value;
			return value;

		case 'boolean':
			return value ? field.trueValue : field.falseValue;

		case 'datetime':
			if (!(value instanceof Date))
				value = new Date(value);
			if (!isFinite(value))
				throw err('not a valid date');
			value = dateTimeFormat(value);
			if (value.length > field.length)
				throw err('too long');
			return value;

		case 'date':
			if (!(value instanceof Date))
				value = new Date(value);
			if (!isFinite(value))
				throw err('not a valid date');
			value = dateFormat(value);
			if (value.length > field.length)
				throw err('too long');
			return value;
	}

	throw new Error('unrecognized type ' + field.type + ' on field ' + field.key);
}
