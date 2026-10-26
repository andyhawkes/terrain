// A text box placed over the map for editing a label in place. Enter or
// clicking away saves; Esc cancels.

var current = null;

// container: the positioned element the box sits in. rect: the screen area
// to cover (e.g. the label being edited), or a point {x, y} for new text.
export function editText(container, rect, value, onCommit, options) {
    close(false);
    options = options || {};
    var box = container.getBoundingClientRect();
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'text-editor';
    input.value = value || '';
    input.placeholder = options.placeholder || '';
    input.setAttribute('aria-label', options.label || 'Text');
    var width = Math.max(160, (rect.width || 0) + 40);
    var cx = (rect.left != null ? rect.left + rect.width / 2 : rect.x) - box.left;
    var cy = (rect.top != null ? rect.top + rect.height / 2 : rect.y) - box.top;
    input.style.width = width + 'px';
    input.style.left = Math.max(4, Math.min(box.width - width - 4, cx - width / 2)) + 'px';
    input.style.top = (cy - 16) + 'px';
    container.appendChild(input);

    var hidden = options.hide || null;
    if (hidden) hidden.style.visibility = 'hidden';

    current = {
        input: input,
        commit: function (save) {
            current = null;
            input.remove();
            if (hidden) hidden.style.visibility = '';
            var text = input.value.trim();
            if (save && text !== (value || '').trim()) onCommit(text);
        }
    };
    input.addEventListener('keydown', function (event) {
        event.stopPropagation();
        if (event.key === 'Enter') close(true);
        else if (event.key === 'Escape') close(false);
    });
    input.addEventListener('blur', function () {close(true)});
    input.focus();
    input.select();
}

export function close(save) {
    if (current) current.commit(save);
}

export function isEditing() {
    return current !== null;
}
