module.exports = function (data) {
	var spec = this.spec;

	if (!(data instanceof Buffer))
		data = new Buffer(data);

	if (data.length === spec.totalLength) {
		var end = data.toString(spec.encoding, spec.length, spec.totalLength);
		if (end != spec.recordEnding)
			throw new Error('invalid record - unexpected record ending');
		data = data.slice(0, spec.length);
	}

	if (data.length !== spec.length)
		throw new Error('invalid record - unexpected length');

	var output = {};

	spec.fields.forEach(function (field) {
		var value = data.toString(spec.encoding, field.startIndex, field.endIndex);

		value = value.trim();
		value = transformValue(value, field);

		if (typeof value === 'string' && value.length === 0 && !field.required)
			value = null;

		output[field.key] = value;
	});

	return output;
};

function transformValue(value, field) {
	function err(msg) {
		if (!msg)
			msg = 'invalid';
		return new Error(['value is', msg, 'for field', field.key, '\n', value].join(' '));
	}

	switch (field.type) {
		case 'string':
			return value;

		case 'integer':
			if (value === null || !value.length)
				return null;
			if (!value.match(/^[0-9]+$/))
				throw err('not an integer');
			return parseInt(value, 10);

		case 'boolean':
			if (value === field.trueValue)
				return true;
			if (value === field.falseValue)
				return false;
			if (!value && !field.required)
				return null;
			throw err('not a boolean');

		case 'datetime':
			if (value === null || !value.length)
				return value;
			try {
				value = new Date(Date.UTC(
					parseInt(value.substr(0, 4), 10),
					parseInt(value.substr(4, 2), 10) - 1,
					parseInt(value.substr(6, 2), 10),
					parseInt(value.substr(8, 2), 10),
					parseInt(value.substr(10, 2), 10)));
			} catch (e) {}
			if (!(value instanceof Date) || !value.getTime())
				throw err('not a valid datetime');
			return value;

		case 'date':
			if (value === null || !value.length)
				return value;
			try {
				value = new Date(Date.UTC(
					parseInt(value.substr(0, 4), 10),
					parseInt(value.substr(4, 2), 10) - 1,
					parseInt(value.substr(6, 2), 10)));
			} catch (e) {}
			if (!(value instanceof Date) || !value.getTime())
				throw err('not a valid date');
			return value;
	}

	throw new Error('unrecognized type ' + field.type + ' on field ' + field.key);
}
