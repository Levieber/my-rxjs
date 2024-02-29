import {
	fromEvent,
	map,
	merge,
	pairwise,
	switchMap,
	takeUntil,
} from "./operators.js";

const events = {
	mousedown: "mousedown",
	mouseup: "mouseup",
	mousemove: "mousemove",
	mouseleave: "mouseleave",
	touchstart: "touchstart",
	touchend: "touchend",
	touchmove: "touchmove",
	click: "click",
};
const canvas = document.querySelector("[data-id='drawing-canvas']");
const clearCanvasButton = document.querySelector(
	"[data-id='clear-canvas-button']",
);
const context = canvas.getContext("2d");

initCanvas(canvas, context);
initClearCanvasButton(clearCanvasButton, context, events);
initDrawingCanvas(canvas, context, events);

function initCanvas(canvas, context) {
	const parent = canvas.parentElement;

	canvas.width = parent.clientWidth * 0.9;
	canvas.height = parent.clientHeight * 2.0;

	context.strokeStyle = "red";
	context.lineWidth = 5;
}

function initClearCanvasButton(clearCanvasButton, context, events) {
	fromEvent(clearCanvasButton, events.click).pipeTo(
		new WritableStream({
			write() {
				context.clearRect(0, 0, canvas.width, canvas.height);
			},
		}),
	);
}

function initDrawingCanvas(canvas, context, events) {
	merge(
		fromEvent(canvas, events.mousedown),
		fromEvent(canvas, events.touchstart).pipeThrough(
			map((event) => touchToMouse(event, events.mousedown)),
		),
	)
		.pipeThrough(
			switchMap(() =>
				merge(
					fromEvent(canvas, events.mousemove),
					fromEvent(canvas, events.touchmove).pipeThrough(
						map((event) => touchToMouse(event, events.mousemove)),
					),
				)
					.pipeThrough(
						takeUntil(
							merge(
								fromEvent(canvas, events.mouseup),
								fromEvent(canvas, events.mouseleave),
								fromEvent(canvas, events.touchend).pipeThrough(
									map((event) => touchToMouse(event, event.mouseup)),
								),
							),
						),
					)
					.pipeThrough(pairwise()),
			),
		)
		.pipeTo(
			new WritableStream({
				write([previousEvent, currentEvent]) {
					if (previousEvent) {
						const previousPositions = getMousePosition(canvas, previousEvent);
						const currentPositions = getMousePosition(canvas, currentEvent);

						context.beginPath();
						context.moveTo(previousPositions.x, previousPositions.y);
						context.lineTo(currentPositions.x, currentPositions.y);
						context.stroke();
					}
				},
			}),
		);
}

function touchToMouse(touchEvent, mouseEvent) {
	const [touch] = touchEvent.touches.length
		? touchEvent.touches
		: touchEvent.changedTouches;

	return new MouseEvent(mouseEvent, {
		clientX: touch.clientX,
		clientY: touch.clientY,
	});
}

function getMousePosition(canvas, eventValue) {
	const rect = canvas.getBoundingClientRect();

	return {
		x: eventValue.clientX - rect.left,
		y: eventValue.clientY - rect.top,
	};
}
