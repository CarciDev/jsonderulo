import { useState, useEffect } from "react";
import { Plus, Presentation, Edit3, ChevronDown } from "lucide-react"; // Add ChevronDown icon
import "./App.css";
import Slide from "./components/Slide";
import useCommand from "./hooks/command";
import { queryPhotos } from "./services/unsplashService";
import { aiRequest } from "./services/aiService";
import { usePresentation } from "./providers/PresentationProvider";
import { useSlideCommands } from "./hooks/useSlideCommands";
import PresenterMode from "./PresenterMode";
import DropdownEditor from "./DropdownEditor";
import AnalyzerChat from "./AnalyzerChart";
import { soundsLikeAnInstruction } from "./services/soundsLikeAnInstruction";

function App() {
  const {
    presentation,
    pushState,
    popState,
    currentSlide,
    setCurrentSlideIndex,
    updateSlide,
    updateElement,
    deleteSlide,
    nextSlide,
    previousSlide,
    addSlide,
    addEmptySlide,
  } = usePresentation();

  const { command, isPolling, startPolling } = useCommand();

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const commandChatGPT = async (instructions) => {
    setLoading(true);
    await aiRequest(
      instructions,
      {
        totalSlides: presentation.slides.length,
        slideSummaries: presentation.slides.map((slide) => ({
          index: presentation.slides.indexOf(slide),
          title: slide.elements.find((el) => el.type === "title")?.content,
        })),
        currentSlide: currentSlide ?? "<None is selected>",
      },
      handleToolCall
    );
    pushState();
    setLoading(false);
  };
  const [isPromptVisible, setIsPromptVisible] = useState(false);
  const [isPromptDropdownVisible, setIsPromptDropdownVisible] = useState(false);

  const deleteCurrentSlide = () => {
    deleteSlide(currentSlide.id);
  };

  const slideActions = {
    addEmptySlide,
    setCurrentSlideIndex,
    totalSlides: presentation.slides.length,
    deleteCurrentSlide,
  };
  const { processCommand } = useSlideCommands(slideActions);

  useEffect(() => {
    if (!isPolling) {
      startPolling();
    }
  }, [isPolling]);

  useEffect(() => {
    console.log(command);
    const instruction = command?.sentence;
    if (instruction) {
      const wasVoiceCommand = processCommand(command);
      if (!wasVoiceCommand && soundsLikeAnInstruction(instruction)) {
        commandChatGPT(command.sentence);
      }
    }
  }, [command]);

  const [isPresenterMode, setIsPresenterMode] = useState(false);

  const handlePromptSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    await commandChatGPT(prompt);
    setPrompt("");
  };

  const handleToolCall = async (toolCall) => {
    const functionArguments = JSON.parse(toolCall.function.arguments);
    switch (toolCall.function.name) {
      case "updateTitle":
        updateElement(currentSlide.id, 0, {
          content: functionArguments.title,
          color: functionArguments.color,
        });
        break;
      case "updateText":
        updateElement(currentSlide.id, 1, {
          content: functionArguments.text,
          color: functionArguments.color,
        });
        break;
      case "updateImage":
        const photoQuery = await queryPhotos(functionArguments.photoQuery);
        const photo = photoQuery[0];
        updateElement(currentSlide.id, 2, {
          src: photo.src,
          alt: photo.alt,
        });
        break;
      case "undo":
        popState();
        break;
      case "deleteSlide":
        deleteSlide(currentSlide.id);
        break;
      case "createBlankSlide":
        addEmptySlide();
        break;
      case "createSlide":
        const photoQuery2 = await queryPhotos(functionArguments.photoQuery);
        const photo2 = photoQuery2[0];
        addSlide({
          elements: [
            {
              id: 1,
              type: "title",
              content: functionArguments.titleContent,
              size: "large",
              color: functionArguments.titleColor,
            },
            {
              id: 2,
              type: "text",
              content: functionArguments.textContent,
              size: "medium",
              color: functionArguments.textColor,
            },
            {
              id: 3,
              type: "image",
              src: photo2.src,
              alt: photo2.alt,
              size: "medium",
            },
          ],
        });
        break;
      case "changeActiveSlide":
        setCurrentSlideIndex(functionArguments.slideIndex);
      default:
        console.warn("Unknown function call:", toolCall.function.name);
    }
  };

  const handleImageError = (e) => {
    // Todo
  };

  const getTitleClassName = (title) => {
    return title.length > 50 ? "small" : "";
  };

  const handlePromptToggle = () => {
    setIsPromptVisible(!isPromptVisible);
  };

  const handlePromptClose = () => {
    setIsPromptVisible(false);
  };

  const handleDeleteSlide = (slideId) => {
    deleteSlide(slideId);
  };

  const [selectedInput, setSelectedInput] = useState("title");
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);

  const handleInputChange = (e) => {
    const { value } = e.target;
    switch (selectedInput) {
      case "title":
        updateElement(currentSlide.id, 0, { content: value });
        break;
      case "text":
        updateElement(currentSlide.id, 1, { content: value });
        break;
      case "image":
        updateElement(currentSlide.id, 2, { src: value });
        break;
      default:
        break;
    }
  };

  const getInputValue = () => {
    switch (selectedInput) {
      case "title":
        return (
          currentSlide.elements.find((el) => el.type === "title")?.content || ""
        );
      case "text":
        return (
          currentSlide.elements.find((el) => el.type === "text")?.content || ""
        );
      case "image":
        return (
          currentSlide.elements.find((el) => el.type === "image")?.src || ""
        );
      default:
        return "";
    }
  };

  const handleDropdownToggle = () => {
    setIsDropdownVisible(!isDropdownVisible);
  };

  const handleDropdownSelect = (inputType) => {
    setSelectedInput(inputType);
    setIsDropdownVisible(false);
  };

  const handlePromptDropdownToggle = () => {
    setIsPromptDropdownVisible(!isPromptDropdownVisible);
  };

  if (isPresenterMode) {
    return (
      <PresenterMode
        slides={presentation.slides}
        currentSlideIndex={0}
        setCurrentSlideIndex={setCurrentSlideIndex}
        onClose={() => setIsPresenterMode(false)}
      />
    );
  }

  return (
    <div className="app">
      {/* toolbar menu */}
      <div className="toolbar">
        <div className="toolbar-left">
          <span className="app-name">PrezPal</span>
          <button onClick={addEmptySlide} className="add-button">
            <Plus />
            New Slide
          </button>
          {currentSlide && (
            <div className="relative">
              <button
                onClick={handleDropdownToggle}
                className="edit-button flex items-center gap-2 px-3 py-2 bg-gray-200 rounded-md border border-gray-300 hover:bg-gray-300"
              >
                <Edit3 />
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    isDropdownVisible ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isDropdownVisible && (
                <div className="absolute left-0 top-full mt-1 w-80 bg-white rounded-md shadow-lg border border-gray-200 p-4 space-y-4 z-10">
                  <DropdownEditor
                    currentSlide={currentSlide}
                    updateElement={updateElement}
                  />
                  <hr className="my-4 border-gray-300" />
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
                    placeholder="Enter your prompt"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handlePromptSubmit}
                      className="px-4 py-2 !bg-blue-400 text-white rounded-md hover:bg-blue-600"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="toolbar-right">
          <button
            onClick={() => setIsPresenterMode(true)}
            className="present-button"
          >
            <Presentation />
            Present
          </button>
        </div>
      </div>

      {/* content */}
      <div className="main-content">
        {/* sidebar */}
        <div className="sidebar">
          {currentSlide &&
            presentation.slides.map((slide, index) => (
              <div
                key={slide.id}
                onClick={() => setCurrentSlideIndex(index)}
                className={`slide-thumbnail ${
                  currentSlide.id === slide.id ? "active" : ""
                }`}
              >
                <div className="slide-number-container">
                  <span className="slide-number">{index + 1}</span>
                  <div className="slide-content">
                    <h3
                      className={`slide-title ${getTitleClassName(
                        slide.elements.find((el) => el.type === "title")
                          ?.content || ""
                      )}`}
                    >
                      {slide.elements.find((el) => el.type === "title")
                        ?.content || "Untitled Slide"}
                    </h3>
                  </div>
                  <button
                    className="delete-slide-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSlide(slide.id);
                    }}
                  >
                    x
                  </button>
                </div>
              </div>
            ))}
        </div>

        {/* slide preview */}
        <div className="slide-preview">
          {currentSlide && (
            <div
              className={`slide landscape ${
                loading ? "shadow animate-[shadow-pulse_1.5s_infinite]" : ""
              }`}
            >
              <Slide
                elements={currentSlide.elements}
                onImageError={handleImageError}
                layout={currentSlide.layout}
              />
            </div>
          )}
        </div>
      </div>

      {/* prompt container */}
      <AnalyzerChat />
    </div>
  );
}

export default App;
