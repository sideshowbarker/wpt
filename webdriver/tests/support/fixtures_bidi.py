import base64
from typing import Any, Mapping

import pytest
import webdriver
from webdriver.bidi.error import (
    InvalidArgumentException,
    NoSuchFrameException,
    NoSuchScriptException,
)
from webdriver.bidi.modules.script import ContextTarget


@pytest.fixture
async def add_preload_script(bidi_session):
    preload_scripts_ids = []

    async def add_preload_script(function_declaration, arguments=None, sandbox=None):
        script = await bidi_session.script.add_preload_script(
            function_declaration=function_declaration,
            arguments=arguments,
            sandbox=sandbox,
        )
        preload_scripts_ids.append(script)

        return script

    yield add_preload_script

    for script in reversed(preload_scripts_ids):
        try:
            await bidi_session.script.remove_preload_script(script=script)
        except (InvalidArgumentException, NoSuchScriptException):
            pass


@pytest.fixture
async def subscribe_events(bidi_session):
    subscriptions = [];
    async def subscribe_events(events, contexts = None):
       await bidi_session.session.subscribe(events=events, contexts=contexts)
       subscriptions.append((events, contexts))

    yield subscribe_events

    for events, contexts in reversed(subscriptions):
        try:
            await bidi_session.session.unsubscribe(
                events=events, contexts=contexts
        )
        except (InvalidArgumentException, NoSuchFrameException):
            pass


@pytest.fixture
async def new_tab(bidi_session):
    """Open and focus a new tab to run the test in a foreground tab."""
    new_tab = await bidi_session.browsing_context.create(type_hint='tab')
    yield new_tab
    # Close the tab.
    await bidi_session.browsing_context.close(context=new_tab["context"])


@pytest.fixture
def send_blocking_command(bidi_session):
    """Send a blocking command that awaits until the BiDi response has been received."""
    async def send_blocking_command(command: str, params: Mapping[str, Any]) -> Mapping[str, Any]:
        future_response = await bidi_session.send_command(command, params)
        return await future_response
    return send_blocking_command


@pytest.fixture
def wait_for_event(bidi_session, event_loop):
    """Wait until the BiDi session emits an event and resolve  the event data."""
    def wait_for_event(event_name: str):
        future = event_loop.create_future()

        async def on_event(method, data):
            remove_listener()
            future.set_result(data)

        remove_listener = bidi_session.add_event_listener(event_name, on_event)

        return future
    return wait_for_event

@pytest.fixture
def current_time(bidi_session, top_context):
    """Get the current time stamp in ms from the remote end.

    This is required especially when tests are run on different devices like
    for Android, where it's not guaranteed that both machines are in sync.
    """
    async def _():
        result = await bidi_session.script.evaluate(
            expression="Date.now()",
            target=ContextTarget(top_context["context"]),
            await_promise=True)
        return result["value"]

    return _


@pytest.fixture
def add_and_remove_iframe(bidi_session, inline):
    """Create a frame, wait for load, and remove it.

    Return the frame's context id, which allows to test for invalid
    browsing context references.
    """
    async def closed_frame(context, url=inline("test-frame")):
        initial_contexts = await bidi_session.browsing_context.get_tree(root=context["context"])
        resp = await bidi_session.script.call_function(
            function_declaration=
            """(url) => {
                const iframe = document.createElement("iframe");
                // Once we're confident implementations support returning the iframe, just
                // return that directly. For now generate a unique id to use as a handle.
                const id = `testframe-${Math.random()}`;
                iframe.id = id;
                iframe.src = url;
                document.documentElement.lastElementChild.append(iframe);
                return new Promise(resolve => iframe.onload = () => resolve(id))
            }""",
            target={"context": context["context"]},
            await_promise=True)
        iframe_dom_id = resp["value"]

        new_contexts = await bidi_session.browsing_context.get_tree(root=context["context"])
        added_contexts = ({item["context"] for item in new_contexts[0]["children"]} -
                          {item["context"] for item in initial_contexts[0]["children"]})
        assert len(added_contexts) == 1
        frame_id = added_contexts.pop()

        await bidi_session.script.evaluate(
            expression=f"document.getElementById('{iframe_dom_id}').remove()",
            target={"context": context["context"]},
            await_promise=False)

        return frame_id
    return closed_frame


@pytest.fixture
def load_pdf(bidi_session, test_page_with_pdf_js, top_context):
    """Load a PDF document in the browser using pdf.js"""
    async def load_pdf(encoded_pdf_data, context=top_context["context"]):
        url = test_page_with_pdf_js(encoded_pdf_data)

        await bidi_session.browsing_context.navigate(
            context=context, url=url, wait="complete"
        )

    return load_pdf


@pytest.fixture
def get_pdf_content(bidi_session, top_context, load_pdf):
    """Load a PDF document in the browser using pdf.js and extract content from the document"""
    async def get_pdf_content(encoded_pdf_data, context=top_context["context"]):
        await load_pdf(encoded_pdf_data=encoded_pdf_data, context=context)

        result = await bidi_session.script.call_function(
            function_declaration="""() => { return window.getText()}""",
            target=ContextTarget(context),
            await_promise=True,
        )

        return result

    return get_pdf_content


@pytest.fixture
def render_pdf_to_png_bidi(bidi_session, new_tab, url):
    """Render a PDF document to png"""

    async def render_pdf_to_png_bidi(
        encoded_pdf_data, page=1
    ):
        await bidi_session.browsing_context.navigate(
            context=new_tab["context"],
            url=url(path="/print_pdf_runner.html"),
            wait="complete",
        )

        result = await bidi_session.script.call_function(
            function_declaration=f"""() => {{ return window.render("{encoded_pdf_data}"); }}""",
            target=ContextTarget(new_tab["context"]),
            await_promise=True,
        )
        value = result["value"]
        index = page - 1

        assert 0 <= index < len(value)

        image_string = value[index]["value"]
        image_string_without_data_type = image_string[image_string.find(",") + 1 :]

        return base64.b64decode(image_string_without_data_type)

    return render_pdf_to_png_bidi
