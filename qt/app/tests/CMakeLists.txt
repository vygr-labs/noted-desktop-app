find_package(Qt6 REQUIRED COMPONENTS Test Quick)

qt_add_executable(test_editor
    test_editor.cpp
    ../src/EditorController.cpp
    ../src/EditorController.h
    ../src/OpenFiles.cpp
    ../src/OpenFiles.h
)
target_include_directories(test_editor PRIVATE ../src)
target_link_libraries(test_editor PRIVATE Noted::Core Qt6::Quick Qt6::Test)
add_test(NAME test_editor COMMAND test_editor)
set_tests_properties(test_editor PROPERTIES ENVIRONMENT "QT_QPA_PLATFORM=offscreen")
