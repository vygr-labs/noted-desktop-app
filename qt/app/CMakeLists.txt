# noted (executable)
#
# Thin QML shell over noted-core: window chrome, the editor bridge
# (EditorController), app services (export/import/hotkey/single instance)
# and the UI.

qt_add_executable(noted WIN32 MACOSX_BUNDLE
    src/main.cpp
    src/AppController.cpp
    src/AppController.h
    src/Zip.cpp
    src/Zip.h
    # Restores Win+Arrow snapping and the taskbar window menu that
    # Qt::FramelessWindowHint takes away. Compiles to nothing elsewhere.
    src/WindowChrome.cpp
    src/WindowChrome.h
)

if(WIN32)
    target_sources(noted PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/../packaging/noted.rc)
endif()

set_source_files_properties(
    qml/Theme.qml
    qml/AppState.qml
    qml/Icons.qml
    PROPERTIES QT_QML_SINGLETON_TYPE TRUE
)

qt_add_qml_module(noted
    URI Noted
    VERSION 1.0
    SOURCES
        src/EditorController.cpp
        src/EditorController.h
        src/OpenFiles.cpp
        src/OpenFiles.h
    QML_FILES
        qml/Main.qml
        qml/Theme.qml
        qml/AppState.qml
        qml/Icons.qml

        qml/controls/Badge.qml
        qml/controls/ColorDot.qml
        qml/controls/Field.qml
        qml/controls/Icon.qml
        qml/controls/IconButton.qml
        qml/controls/Kbd.qml
        qml/controls/MenuRow.qml
        qml/controls/ModalDialog.qml
        qml/controls/PopupMenu.qml
        qml/controls/ResizeFrame.qml
        qml/controls/WindowButtons.qml
        qml/controls/DragArea.qml
        qml/controls/ScrollBarThin.qml
        qml/controls/TextButton.qml
        qml/controls/Tip.qml
        qml/controls/Toggle.qml

        qml/panels/MiniCalendar.qml
        qml/panels/OpenTasks.qml
        qml/panels/Sidebar.qml
        qml/panels/NoteListPane.qml
        qml/panels/NoteCard.qml
        qml/panels/PopoutManager.qml
        qml/panels/PopoutWindow.qml

        qml/editor/EditorPane.qml
        qml/editor/EditorToolbar.qml
        qml/editor/FindBar.qml
        qml/editor/LockOverlay.qml
        qml/editor/NoteHeader.qml
        qml/editor/PlainEditor.qml
        qml/editor/RichEditor.qml
        qml/editor/TagsBar.qml

        qml/todos/TodoView.qml
        qml/todos/TodoRow.qml

        qml/dialogs/CommandPalette.qml
        qml/dialogs/SettingsDialog.qml
        qml/dialogs/PinDialog.qml
        qml/dialogs/QuickCapture.qml
)

qt_add_resources(noted "noted_assets"
    PREFIX "/"
    BASE resources
    FILES
        resources/fonts/IBMPlexSans-Variable.ttf
        resources/fonts/IBMPlexSans-Italic-Variable.ttf
        resources/fonts/IBMPlexMono-Regular.ttf
        resources/fonts/IBMPlexMono-Italic.ttf
        resources/fonts/IBMPlexMono-Medium.ttf
        resources/fonts/IBMPlexMono-SemiBold.ttf
        resources/fonts/lucide.ttf
        resources/brand/icon.png
        resources/brand/noted-logo.svg
        resources/brand/noted-icon.svg
)

target_include_directories(noted PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)

target_link_libraries(noted PRIVATE
    Noted::Core
    Qt6::Gui
    Qt6::Qml
    Qt6::Quick
    Qt6::QuickControls2
    Qt6::Network
    Qt6::Svg
)

set_target_properties(noted PROPERTIES
    OUTPUT_NAME noted
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}
    MACOSX_BUNDLE_GUI_IDENTIFIER com.voyagertech.noted
    MACOSX_BUNDLE_BUNDLE_VERSION ${PROJECT_VERSION}
    MACOSX_BUNDLE_SHORT_VERSION_STRING ${PROJECT_VERSION}
)

install(TARGETS noted BUNDLE DESTINATION . RUNTIME DESTINATION bin)
