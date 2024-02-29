/**
 * @param {EventTarget} target
 * @param {string} eventName
 * @returns {ReadableStream}
 */
export const fromEvent = (target, eventName) => {
	let _listener;
	return new ReadableStream({
		start(controller) {
			_listener = (event) => controller.enqueue(event);
			target.addEventListener(eventName, _listener, { passive: true });
		},
		cancel() {
			target.removeEventListener(eventName, _listener);
		},
	});
};

/**
 * @param {Array<ReadableStream | TransformStream>} streams
 * @returns {ReadableStream}
 */
export const merge = (...streams) => {
	return new ReadableStream({
		start(controller) {
			for (const stream of streams) {
				const reader = (stream.readable ?? stream).getReader();

				(async function read() {
					const { value, done } = await reader.read();

					if (done) return;
					if (controller.desiredSize === 0) return;

					controller.enqueue(value);

					return read();
				})();
			}
		},
	});
};

/**
 * @param {number} milliseconds
 * @returns {ReadableStream}
 */
export const interval = (milliseconds) => {
	let _intervalId;
	return new ReadableStream({
		start(controller) {
			_intervalId = setInterval(
				() => controller.enqueue(new Date()),
				milliseconds,
			);
		},
		cancel() {
			clearInterval(_intervalId);
		},
	});
};

/**
 * @param {(arg: any) => any} fn
 * @returns {TransformStream}
 */
export const map = (fn) => {
	return new TransformStream({
		transform(chunk, controller) {
			controller.enqueue(fn(chunk));
		},
	});
};

/**
 * @param {(arg: any) => ReadableStream | TransformStream} fn
 * @param {object} options
 * @param {boolean} options.pairwise
 * @returns {TransformStream}
 */
export const switchMap = (fn) => {
	return new TransformStream({
		transform(chunk, controller) {
			const stream = fn(chunk);
			const reader = (stream.readable ?? stream).getReader();

			return (async function read() {
				const { value, done } = await reader.read();

				if (done) return;

				controller.enqueue(value);

				return read();
			})();
		},
	});
};

/**
 * @param {ReadableStream | TransformStream} stream
 * @returns {TransformStream}
 */
export const takeUntil = (stream) => {
	const readAndTerminate = async (stream, controller) => {
		const reader = (stream.readable ?? stream).getReader();
		const { value } = await reader.read();
		controller.enqueue(value);
		controller.terminate();
	};

	return new TransformStream({
		start(controller) {
			readAndTerminate(stream, controller);
		},
		transform(chunk, controller) {
			controller.enqueue(chunk);
		},
	});
};

/**
 * @returns {TransformStream}
 */
export const pairwise = () => {
	let lastValue;
	return new TransformStream({
		transform(chunk, controller) {
			if (lastValue) {
				controller.enqueue([lastValue, chunk]);
			}
			lastValue = chunk;
		},
	});
}
